const { OpenAI } = require('openai');

let openaiClient = null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
}

/**
 * AI Pre-booking Symptom Checker
 * Analyzes symptoms and suggests which specialist to see.
 */
async function getSpecialistRecommendation(symptoms) {
  const defaultSpecialists = [
    'General Physician',
    'Cardiologist',
    'Dermatologist',
    'Pediatrician',
    'Gynecologist',
    'Orthopedic',
    'Neurologist'
  ];

  if (!openaiClient) {
    // Mock Rule-Based Symptom Checker
    const sym = symptoms.toLowerCase();
    let specialty = 'General Physician';
    let reasoning = 'Based on your general symptoms, starting with a General Physician is recommended for initial assessment.';

    if (sym.includes('heart') || sym.includes('chest pain') || sym.includes('palpitations') || sym.includes('cardio')) {
      specialty = 'Cardiologist';
      reasoning = 'Chest discomfort or heart palpitations suggest a cardiac evaluation is appropriate.';
    } else if (sym.includes('skin') || sym.includes('rash') || sym.includes('acne') || sym.includes('itching') || sym.includes('dermat')) {
      specialty = 'Dermatologist';
      reasoning = 'Symptoms affecting the skin, such as rashes or severe itching, are best evaluated by a Dermatologist.';
    } else if (sym.includes('child') || sym.includes('baby') || sym.includes('kid') || sym.includes('pediatric')) {
      specialty = 'Pediatrician';
      reasoning = 'Medical concerns for children and infants require specialized pediatric care.';
    } else if (sym.includes('pregnant') || sym.includes('pregnancy') || sym.includes('gyno') || sym.includes('menstrual')) {
      specialty = 'Gynecologist';
      reasoning = 'Concerns related to reproductive health or pregnancy should be directed to a Gynecologist.';
    } else if (sym.includes('bone') || sym.includes('joint') || sym.includes('fracture') || sym.includes('back pain') || sym.includes('knee')) {
      specialty = 'Orthopedic';
      reasoning = 'Joint, bone, or muscle issues warrant review by an Orthopedic specialist.';
    } else if (sym.includes('headache') || sym.includes('migraine') || sym.includes('seizure') || sym.includes('numbness') || sym.includes('neuro')) {
      specialty = 'Neurologist';
      reasoning = 'Persistent headaches, neurological numbness, or nervous system concerns suggest a Neurologist.';
    }

    return { specialty, reasoning };
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an AI Symptom Checker for a Telehealth platform. Analyze the user's symptoms and suggest exactly ONE of the following specialists: ${defaultSpecialists.join(', ')}. Return a JSON object with keys "specialty" and "reasoning". Keep "reasoning" under 30 words.`
        },
        {
          role: 'user',
          content: `Symptoms: "${symptoms}"`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error with Gemini API (Symptom Check):', error.message);
    // Graceful fallback
    return {
      specialty: 'General Physician',
      reasoning: 'Gemini API encountered an issue. Consulting a General Physician is recommended for initial assessment.'
    };
  }
}

/**
 * AI Consultation Summary
 * Summarizes the doctor-patient dialogue and prescription details.
 */
async function generateConsultationSummary(chatHistory, prescription) {
  if (!openaiClient) {
    // Mock summary
    const diagnosis = prescription ? prescription.diagnosis : 'unspecified symptoms';
    const meds = prescription && prescription.medicines.length > 0
      ? prescription.medicines.map(m => m.name).join(', ')
      : 'no medications prescribed';
    return `During the consultation, the doctor diagnosed the condition as: "${diagnosis}". The primary recommendation includes taking: ${meds}. Please rest, stay hydrated, and strictly follow the medication schedule outlined in your digital prescription.`;
  }

  try {
    const formattedChat = chatHistory.map(m => `${m.senderId}: ${m.content}`).join('\n');
    const response = await openaiClient.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a medical scribe. Summarize the telehealth consultation chat history and prescription in a 2-3 sentence patient-friendly summary. Focus on what was discussed, the diagnosis, and the treatment plan.'
        },
        {
          role: 'user',
          content: `Chat history:\n${formattedChat}\n\nPrescription details:\nDiagnosis: ${prescription?.diagnosis || 'N/A'}\nMedicines: ${JSON.stringify(prescription?.medicines || [])}\nNotes: ${prescription?.notes || 'None'}`
        }
      ]
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with Gemini API (Summary):', error.message);
    return 'Failed to generate summary using Gemini API. Please refer to your digital prescription for diagnosis and medicine schedules.';
  }
}

/**
 * AI Follow-up Recommendation
 * Analyzes the notes and chat to suggest follow-up intervals and red flags.
 */
async function generateFollowUpReminder(chatHistory, prescription) {
  if (!openaiClient) {
    // Mock follow up reminder
    return `Follow up in 5 to 7 days if symptoms persist or do not improve. Watch out for red flags: high fever (>101°F), difficulty breathing, severe pain, or allergic reactions to prescribed medicines. If any are present, seek immediate emergency medical care.`;
  }

  try {
    const formattedChat = chatHistory.map(m => `${m.senderId}: ${m.content}`).join('\n');
    const response = await openaiClient.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are an AI follow-up advisor. Based on this consultation chat and prescription, determine: 1. Recommended follow-up timeline (e.g., 1 week, 3 days). 2. Key warning signs / red flag symptoms to watch out for. Write a concise 2-sentence recommendation to the patient.'
        },
        {
          role: 'user',
          content: `Chat history:\n${formattedChat}\n\nPrescription details:\nDiagnosis: ${prescription?.diagnosis || 'N/A'}\nMedicines: ${JSON.stringify(prescription?.medicines || [])}\nNotes: ${prescription?.notes || 'None'}`
        }
      ]
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with Gemini API (Follow-up):', error.message);
    return 'Ensure to consult your physician if your condition worsens or does not improve within a week.';
  }
}

module.exports = {
  getSpecialistRecommendation,
  generateConsultationSummary,
  generateFollowUpReminder
};
