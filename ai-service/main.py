import os
import json
import logging
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdfplumber
import httpx

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="MedConnect AI Service",
    description="Lightweight medical document analyzer and report chat service using Gemini API."
)

# Enable CORS for frontend and gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fetch Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    GEMINI_API_KEY = os.getenv("GROK_API_KEY", "")

is_configured = bool(GEMINI_API_KEY)
if is_configured:
    logger.info("Gemini API key configured successfully.")
else:
    logger.warning("GEMINI_API_KEY / GROK_API_KEY environment variable is not set. Running in MOCK mode.")

# Pydantic schema validation for chat endpoint
class ChatRequest(BaseModel):
    report_text: str
    question: str

async def call_gemini_api(
    prompt: str,
    system_instruction: Optional[str] = None,
    json_mode: bool = False
) -> str:
    """Makes a direct REST call to the Gemini API using httpx."""
    key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GROK_API_KEY", "")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [
                {"text": system_instruction}
            ]
        }
        
    if json_mode:
        payload["generationConfig"] = {
            "responseMimeType": "application/json"
        }
        
    headers = {"Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=45.0) as httpx_client:
        logger.info(f"Posting request to Gemini API (json_mode={json_mode})...")
        response = await httpx_client.post(url, json=payload, headers=headers)
        
        if response.status_code != 200:
            error_detail = response.text
            logger.error(f"Gemini API returned status code {response.status_code}: {error_detail}")
            raise HTTPException(status_code=502, detail=f"Gemini API error: {error_detail}")
            
        res_json = response.json()
        try:
            text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip()
        except (KeyError, IndexError) as e:
            logger.error(f"Malformed Gemini response format: {res_json}")
            raise ValueError("Failed to parse output text from Gemini response structure.")

@app.get("/health")
def health_check():
    """Health status and configuration diagnostics."""
    return {
        "status": "healthy",
        "gemini_configured": is_configured or bool(os.getenv("GEMINI_API_KEY") or os.getenv("GROK_API_KEY")),
        "environment": "development" if not os.getenv("PORT") else "production"
    }

@app.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):
    """
    Accepts medical report PDF file, extracts its text,
    calls Gemini API to retrieve a structured clinical analysis, and returns it.
    """
    if not file.filename.lower().endswith('.pdf'):
        logger.error(f"Unsupported file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    extracted_text = ""
    try:
        # Extract text page-by-page using pdfplumber
        logger.info(f"Extracting text from PDF file: {file.filename}")
        with pdfplumber.open(file.file) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    extracted_text += f"--- Page {i+1} ---\n{page_text}\n"
    except Exception as e:
        logger.exception("Failed to parse PDF with pdfplumber")
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(e)}")

    extracted_text = extracted_text.strip()
    if not extracted_text:
        logger.error("No extractable text found in the uploaded PDF.")
        raise HTTPException(status_code=400, detail="Uploaded PDF contains no text. Please upload a digital PDF report.")

    key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GROK_API_KEY", "")
    if not key:
        logger.info("Gemini key not available in environment. Returning simulated mock analysis.")
        return {
            "summary": "Simulated analysis: Complete Blood Count shows mild vitamin D deficiency and borderline elevated cholesterol.",
            "report_type": "Blood Panel / Biochemistry",
            "severity": "low",
            "abnormal_findings": [
                {
                    "finding": "Vitamin D, 25-Hydroxy",
                    "value": "18 ng/mL",
                    "reference_range": "30 - 100 ng/mL",
                    "explanation": "Your Vitamin D is below the recommended reference range, which is common but can affect bone strength, muscle health, and immune function."
                },
                {
                    "finding": "Total Cholesterol",
                    "value": "205 mg/dL",
                    "reference_range": "< 200 mg/dL",
                    "explanation": "Borderline elevated. Keep an eye on dietary fat intake and incorporate light exercise."
                }
            ],
            "potential_concerns": [
                "Hypovitaminosis D (Vitamin D deficiency)",
                "Borderline Hypercholesterolemia"
            ],
            "recommended_specialists": [
                "General Physician",
                "Orthopedic"
            ],
            "next_steps": [
                "Consult with a General Physician to discuss vitamin D supplements.",
                "Incorporate more vitamin-D rich foods (fatty fish, egg yolks, fortified milk) and get 15 minutes of sunlight daily.",
                "Review dietary fat and saturated fat intake; incorporate more whole grains and fiber."
            ],
            "requires_urgent_attention": False,
            "urgent_reason": None,
            "patient_friendly_explanation": "Your blood test indicates that most of your markers are in healthy ranges. The main areas for attention are your Vitamin D level, which is low, and your cholesterol, which is slightly above the threshold. These are very common findings and can typically be addressed with simple dietary adjustments, mild exercise, and over-the-counter supplements as advised by your doctor.",
            "disclaimer": "This analysis is AI-generated and is for informational purposes only. It does not replace professional medical judgment. Please consult with a physician.",
            "extracted_text": extracted_text
        }

    # Prompt crafting for structured clinical insights
    prompt = f"""
    You are an expert clinical document analyzer. Analyze the text extracted from a patient's medical report and output a highly structured analysis in JSON format.
    
    Medical Report Extracted Text:
    ===
    {extracted_text}
    ===

    You must output a single valid JSON object containing exactly the following keys:
    - "summary": A short 1-2 sentence overview of the report's general finding/impression.
    - "report_type": The type of medical report (e.g. "Complete Blood Count", "Lipid Profile", "MRI Brain", "Urinalysis").
    - "severity": The general clinical urgency level. Must be exactly one of: "low", "medium", "high", or "critical".
    - "abnormal_findings": A list of objects containing details of abnormal/out-of-bounds parameters. Each object must have:
      - "finding": The test parameter name.
      - "value": The reported value.
      - "reference_range": The normal range reference listed in the document.
      - "explanation": A patient-friendly explanation of what this parameter means and why it's out of range.
    - "potential_concerns": A list of strings listing health issues flagged or implied by the report findings.
    - "recommended_specialists": A list of relevant specialties the patient should consult. Match these EXACTLY to any of:
      "General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Gynecologist", "Orthopedic", "Neurologist".
    - "next_steps": A list of helpful, clinical, and actionable next steps or lifestyle suggestions.
    - "requires_urgent_attention": A boolean indicating if there is a severe risk requiring immediate attention.
    - "urgent_reason": A string detailing the reason for urgency if requires_urgent_attention is true, otherwise null.
    - "patient_friendly_explanation": A warm, encouraging, easy-to-understand explanation of the overall results in patient-friendly terms, avoiding complex jargon.
    - "disclaimer": Standard medical disclaimer warning the patient to seek professional care.

    CRITICAL RULES:
    1. Do not include markdown code block formatting (like ```json) or any conversational text before or after the JSON.
    2. Output must be raw valid JSON only.
    """

    try:
        analysis_json = await call_gemini_with_validation(prompt, tries=2)
        analysis_json["extracted_text"] = extracted_text
        return analysis_json
    except Exception as e:
        logger.exception("Failed to analyze medical report via Gemini")
        raise HTTPException(status_code=500, detail=f"Failed to analyze report: {str(e)}")

async def call_gemini_with_validation(prompt: str, tries: int = 2) -> dict:
    """Queries Gemini, attempts to parse and validate, retries once if json parsing fails."""
    system_instruction = "You are a clinical AI assistant that outputs structured findings strictly in JSON format. Do not write any markdown code blocks or explanations outside of the JSON."
    
    for attempt in range(tries):
        try:
            logger.info(f"Querying Gemini (attempt {attempt+1}/{tries})...")
            content = await call_gemini_api(
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=True
            )
            
            # Strip markdown formatting if the model returned it anyway
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()
            
            # Attempt parsing
            parsed_data = json.loads(content)
            
            # Validation checks
            required_keys = ["summary", "report_type", "severity", "abnormal_findings", "recommended_specialists", "patient_friendly_explanation", "disclaimer"]
            for key in required_keys:
                if key not in parsed_data:
                    raise KeyError(f"Missing required key in JSON output: {key}")
            
            return parsed_data
        except Exception as e:
            logger.warning(f"Failed to parse Gemini response on attempt {attempt+1}: {str(e)}")
            if attempt == tries - 1:
                raise e
            # Append retry instruction to prompt
            prompt += f"\n\nERROR: Your previous response was invalid JSON or missed some fields. Ensure you output a valid JSON object with the following fields: summary, report_type, severity, abnormal_findings (with finding, value, reference_range, explanation), potential_concerns, recommended_specialists, next_steps, requires_urgent_attention, urgent_reason, patient_friendly_explanation, disclaimer."

@app.post("/chat")
async def chat_about_report(req: ChatRequest):
    """
    Processes patient questions regarding their analyzed medical report text,
    returning clinical context-aware explanations.
    """
    key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GROK_API_KEY", "")
    if not key:
        return {
            "answer": f"Mock Chat Response: Regarding your question about '{req.question}', your report mentions normal vitamin levels except for Vitamin D. Normal values are above 30 ng/mL, and your value is 18 ng/mL. Please consult your General Physician."
        }

    prompt = f"""
    The patient is asking a question about their medical report.
    Below is the full text of the medical report:
    ===
    {req.report_text}
    ===

    Patient's Question:
    "{req.question}"

    Provide a clear, reassuring, and highly accurate answer in simple, layman's terms. Emphasize patient safety.
    If the question is completely unrelated to the medical report or medical/health concerns, politely steer the conversation back to their medical report.
    Always append a small reminder that this is AI support and they should consult their doctor.
    """

    try:
        logger.info("Processing patient chat query with Gemini...")
        answer = await call_gemini_api(
            prompt=prompt,
            system_instruction="You are a compassionate telehealth AI assistant helping patients understand their medical reports."
        )
        return {"answer": answer}
    except Exception as e:
        logger.exception("Failed to process chat query")
        raise HTTPException(status_code=500, detail=f"Failed to query AI assistant: {str(e)}")
