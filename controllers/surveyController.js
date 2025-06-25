const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const templatesCollection = db.collection('surveyTemplates');
const surveysCollection = db.collection('surveys');
const responsesCollection = db.collection('surveyResponses');


// [KODE LAMA ANDA SEBELUMNYA ADA DI SINI, SAYA HANYA MENAMPILKAN FUNGSI BARU DI BAWAH]

// =========================================================================
//                           FUNGSI BARU DITAMBAHKAN
// =========================================================================

/**
 * @description Get a single survey for public view (for respondents). No auth needed.
 * @route GET /api/surveys/public/:id
 */
// =========================================================================
//                           FUNGSI UNTUK PUBLIK / NARASUMBER
// =========================================================================

/**
 * @description Get a single survey for public view (for respondents).
 * @route GET /api/surveys/public/:id
 */
exports.getPublicSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Survey ID is required' });

        const surveyDoc = await surveysCollection.doc(id).get();
        if (!surveyDoc.exists) return res.status(404).json({ error: 'Survei tidak ditemukan.' });

        const surveyData = surveyDoc.data();
        if (surveyData.status !== 'Aktif') {
            return res.status(403).json({ error: 'Survei ini sedang tidak aktif.' });
        }

        const publicSurveyData = {
            id: surveyDoc.id,
            title: surveyData.title,
            questions: surveyData.questions.map(q => ({
                id: q.id, text: q.text, type: q.type, options: q.options || {},
            })),
        };
        res.status(200).json(publicSurveyData);
    } catch (error) {
        console.error('Error fetching public survey:', error);
        res.status(500).json({ error: 'Gagal memuat detail survei.' });
    }
};

/**
 * @description Submit a response to a survey.
 * @route POST /api/surveys/:id/responses
 */
exports.submitSurveyResponse = async (req, res) => {
    console.log(`[submitSurveyResponse] Received request for survey ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        console.log('[submitSurveyResponse] Request body:', JSON.stringify(req.body, null, 2));

        if (!req.body || !req.body.answers) {
            return res.status(400).json({ error: 'Request tidak valid, data jawaban tidak ditemukan.' });
        }

        const { answers } = req.body;
        if (!id || typeof answers !== 'object' || answers === null) {
            return res.status(400).json({ error: 'ID Survei dan objek jawaban yang valid diperlukan.' });
        }

        const surveyRef = surveysCollection.doc(id);

        const newResponse = {
            surveyId: id,
            answers,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        console.log('[submitSurveyResponse] Menambahkan jawaban baru:', JSON.stringify(newResponse, null, 2));
        await responsesCollection.add(newResponse); // Menggunakan variabel yang sudah didefinisikan
        console.log('[submitSurveyResponse] Jawaban berhasil disimpan di koleksi surveyResponses.');

        await db.runTransaction(async (transaction) => {
            console.log('[submitSurveyResponse] Memulai transaksi update jumlah responden...');
            const freshSurveyDoc = await transaction.get(surveyRef);
            if (!freshSurveyDoc.exists) throw new Error('Dokumen survei tidak ditemukan di dalam transaksi.');

            const newResponseCount = (freshSurveyDoc.data().responses || 0) + 1;
            console.log(`[submitSurveyResponse] Update jumlah responden dari ${freshSurveyDoc.data().responses || 0} menjadi ${newResponseCount}`);
            transaction.update(surveyRef, { responses: newResponseCount });
        });

        console.log('[submitSurveyResponse] Transaksi selesai.');
        res.status(201).json({ message: 'Jawaban berhasil dikirim.' });

    } catch (error) {
        console.error('!!! [submitSurveyResponse] ERROR KRITIS:', error);
        res.status(500).json({ error: 'Gagal mengirim jawaban.', details: error.message });
    }
};

// =========================================================================
//                  FUNGSI ANALISIS BARU UNTUK DASBOR
// =========================================================================
/**
 * @description Get full analysis of a survey's responses for the dashboard.
 * @route GET /api/surveys/:id/analysis
 * @access Private (for researcher)
 */
exports.getSurveyAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Survey ID is required' });
        }

        // 1. Ambil data survei utama
        const surveyDoc = await surveysCollection.doc(id).get();
        if (!surveyDoc.exists) {
            return res.status(404).json({ error: 'Survei tidak ditemukan.' });
        }
        const surveyData = surveyDoc.data();

        // 2. Ambil semua jawaban (responses) untuk survei ini
        const responsesSnapshot = await responsesCollection.where('surveyId', '==', id).get();
        if (responsesSnapshot.empty) {
            return res.status(200).json({
                message: "Belum ada responden untuk survei ini.",
                analysis: null // Kirim null agar frontend bisa menanganinya
            });
        }
        const rawResponses = responsesSnapshot.docs.map(doc => doc.data());
        const totalRespondents = rawResponses.length;

        // 3. Proses dan Agregasi Jawaban
        const analysis = {
            questionResults: {}, // { q_id_1: { ... }, q_id_2: { ... } }
            openEndedSamples: {}, // { q_id_1: [ "sample1", ... ] }
            descriptiveStats: {}, // { q_id_scale: { ... } }
        };
        const allAnswersByQuestion = {}; // { q_id_1: [ans1, ans2, ...], q_id_2: [ans1, ans2, ...] }

        surveyData.questions.forEach(q => {
            allAnswersByQuestion[q.id] = [];
        });

        // Kumpulkan semua jawaban per pertanyaan
        for (const response of rawResponses) {
            for (const questionId in response.answers) {
                if (allAnswersByQuestion.hasOwnProperty(questionId)) {
                    allAnswersByQuestion[questionId].push(response.answers[questionId]);
                }
            }
        }

        // 4. Hitung frekuensi & statistik untuk setiap pertanyaan
        for (const question of surveyData.questions) {
            const questionId = question.id;
            const answers = allAnswersByQuestion[questionId];

            if (question.type === 'multiple_choice' || question.type === 'dropdown') {
                const freqs = answers.reduce((acc, answer) => {
                    acc[answer] = (acc[answer] || 0) + 1;
                    return acc;
                }, {});

                const sortedLabels = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]);
                const sortedData = sortedLabels.map(label => freqs[label]);

                analysis.questionResults[questionId] = {
                    type: 'bar',
                    chartOptions: {
                        chart: { type: 'bar' },
                        plotOptions: { bar: { horizontal: true } },
                        xaxis: { categories: sortedLabels }
                    },
                    series: [{ name: 'Responden', data: sortedData }]
                };

            } else if (question.type === 'open-ended') {
                analysis.openEndedSamples[questionId] = answers.slice(0, 5); // Ambil 5 sampel

            } else if (question.type === 'scale') {
                const numericAnswers = answers.map(Number).filter(n => !isNaN(n));
                if (numericAnswers.length > 0) {
                    const sum = numericAnswers.reduce((a, b) => a + b, 0);
                    const mean = sum / numericAnswers.length;
                    numericAnswers.sort((a, b) => a - b);
                    const mid = Math.floor(numericAnswers.length / 2);
                    const median = numericAnswers.length % 2 !== 0 ? numericAnswers[mid] : (numericAnswers[mid - 1] + numericAnswers[mid]) / 2;
                    const stdDev = Math.sqrt(numericAnswers.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / numericAnswers.length);

                    analysis.descriptiveStats[question.text] = {
                        question: question.text,
                        mean: mean,
                        median: median,
                        stdDev: stdDev,
                        min: Math.min(...numericAnswers),
                        max: Math.max(...numericAnswers)
                    };
                }
            }
        }

        // 5. Gabungkan semua data menjadi satu objek respons
        const responsePayload = {
            id: surveyDoc.id,
            title: surveyData.title,
            status: surveyData.status,
            stats: {
                totalRespondents: totalRespondents,
                completionRate: surveyData.target > 0 ? Math.round((totalRespondents / surveyData.target) * 100) : 100, // Simulasi completion rate
                avgTime: 8, // Data ini tidak ada di model, jadi kita simulasikan
            },
            questions: surveyData.questions.map(q => ({
                id: q.id,
                text: q.text,
                type: q.type,
                results: analysis.questionResults[q.id],
                samples: analysis.openEndedSamples[q.id],
            })),
            analysis: {
                // Sediakan data mentah untuk crosstab dan chart builder di frontend
                structuredRawData: rawResponses.map((r, i) => ({ respId: `r${i + 1}`, answers: r.answers })),
                categoricalQuestions: surveyData.questions.filter(q => ['multiple_choice', 'dropdown'].includes(q.type)),
                allQuestionsForAnalysis: surveyData.questions.map(q => ({ id: q.id, text: q.text })),
                descriptiveStats: Object.values(analysis.descriptiveStats)
            },
            // Demografi perlu pertanyaan spesifik (misal, 'gender', 'usia'), ini contoh simplifikasi
            demographics: { /* Untuk implementasi nyata, ini perlu diproses seperti pertanyaan lain */ }
        };

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error('Error getting survey analysis:', error);
        res.status(500).json({ error: 'Gagal mengambil analisis survei.', details: error.message });
    }
};


// Get all templates
exports.getTemplates = async (req, res) => {
    try {
        const snapshot = await templatesCollection.get();
        const templates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

// Create a new template
exports.createTemplate = async (req, res) => {
    try {
        const { title, description, questions } = req.body;
        if (!title || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Title and questions (array) are required' });
        }

        const newTemplate = {
            title,
            description: description || '',
            questions,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await templatesCollection.add(newTemplate);
        res.status(201).json({ id: docRef.id, ...newTemplate });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};

// Update an existing template
exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, questions } = req.body;
        if (!id || !title || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'ID, title, and questions (array) are required' });
        }

        const updateData = {
            title,
            description: description || '',
            questions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await templatesCollection.doc(id).update(updateData);
        res.status(200).json({ id, ...updateData });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Template ID is required' });
        }

        await templatesCollection.doc(id).delete();
        res.status(200).json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

// Get all surveys
exports.getSurveys = async (req, res) => {
    try {
        const snapshot = await surveysCollection.get();
        const surveys = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            creationDate: doc.data().creationDate?.toDate ? doc.data().creationDate.toDate() : new Date(),
        }));
        res.status(200).json(surveys);
    } catch (error) {
        console.error('Error fetching surveys:', error);
        res.status(500).json({ error: 'Failed to fetch surveys' });
    }
};

// Create a new survey
exports.createSurvey = async (req, res) => {
    try {
        const { title, startDate, endDate, variable, target, questions, templateId, status, createdBy } = req.body;

        // Validate required fields
        if (!title || !startDate || !endDate || !variable || !questions || !Array.isArray(questions) || target < 0) {
            return res.status(400).json({ error: 'Title, startDate, endDate, variable, target (non-negative), and questions (array) are required' });
        }

        let finalQuestions = questions;
        if (templateId) {
            const templateDoc = await templatesCollection.doc(templateId).get();
            if (!templateDoc.exists) {
                return res.status(404).json({ error: 'Template not found' });
            }
            // Merge template questions with variable replacement
            finalQuestions = templateDoc.data().questions.map((q) => ({
                ...q,
                id: q.id || `${Date.now()}${Math.random()}`,
                text: q.text.replace('{variable}', variable || ''),
                options: q.options || {},
            }));
        }

        // Validate questions
        for (const question of finalQuestions) {
            if (!question.text) {
                return res.status(400).json({ error: 'All questions must have text' });
            }
            if (['multiple_choice', 'checkbox', 'dropdown'].includes(question.type)) {
                if (!question.options?.choices || !Array.isArray(question.options.choices) || question.options.choices.every(opt => !opt.trim())) {
                    return res.status(400).json({ error: 'Questions with choices must have at least one valid option' });
                }
            }
            if (['grid_choice', 'grid_checkbox'].includes(question.type)) {
                if (!question.options?.rows?.length || !question.options?.columns?.length) {
                    return res.status(400).json({ error: 'Grid questions must have rows and columns' });
                }
            }
            if (question.type === 'scale' && question.options?.min >= question.options?.max) {
                return res.status(400).json({ error: 'Scale minimum must be less than maximum' });
            }
        }

        const newSurvey = {
            title,
            startDate,
            endDate,
            variable,
            target: Number(target) || 0,
            questions: finalQuestions,
            templateId: templateId || '',
            status: status || 'Draft',
            createdBy: createdBy || 'Unknown',
            creationDate: admin.firestore.FieldValue.serverTimestamp(),
            responses: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await surveysCollection.add(newSurvey);
        res.status(201).json({ id: docRef.id, ...newSurvey });
    } catch (error) {
        console.error('Error creating survey:', error);
        res.status(500).json({ error: 'Failed to create survey: ' + error.message });
    }
};

// Update an existing survey
exports.updateSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, startDate, endDate, variable, target, questions, templateId, status, createdBy, responses } = req.body;

        // Validate required fields
        if (!id || !title || !startDate || !endDate || !variable || !questions || !Array.isArray(questions) || target < 0) {
            return res.status(400).json({ error: 'ID, title, startDate, endDate, variable, target (non-negative), and questions (array) are required' });
        }

        // Validate questions
        for (const question of questions) {
            if (!question.text) {
                return res.status(400).json({ error: 'All questions must have text' });
            }
            if (['multiple_choice', 'checkbox', 'dropdown'].includes(question.type)) {
                if (!question.options?.choices || !Array.isArray(question.options.choices) || question.options.choices.every(opt => !opt.trim())) {
                    return res.status(400).json({ error: 'Questions with choices must have at least one valid option' });
                }
            }
            if (['grid_choice', 'grid_checkbox'].includes(question.type)) {
                if (!question.options?.rows?.length || !question.options?.columns?.length) {
                    return res.status(400).json({ error: 'Grid questions must have rows and columns' });
                }
            }
            if (question.type === 'scale' && question.options?.min >= question.options?.max) {
                return res.status(400).json({ error: 'Scale minimum must be less than maximum' });
            }
        }

        const updateData = {
            title,
            startDate,
            endDate,
            variable,
            target: Number(target) || 0,
            questions,
            templateId: templateId || '',
            status: status || 'Draft',
            createdBy: createdBy || 'Unknown',
            responses: Number(responses) || 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await surveysCollection.doc(id).update(updateData);
        res.status(200).json({ id, ...updateData });
    } catch (error) {
        console.error('Error updating survey:', error);
        res.status(500).json({ error: 'Failed to update survey: ' + error.message });
    }
};

// Delete a survey
exports.deleteSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Survey ID is required' });
        }

        await surveysCollection.doc(id).delete();
        res.status(200).json({ message: 'Survey deleted successfully' });
    } catch (error) {
        console.error('Error deleting survey:', error);
        res.status(500).json({ error: 'Failed to delete survey' });
    }
};