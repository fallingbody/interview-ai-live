import jwt from 'jsonwebtoken';

/**
 * Splits a list of candidate emails into exactly N equal batches.
 * Uses sequential chunking to distribute candidates as evenly as possible.
 * If the number of candidates is not perfectly divisible, remainder
 * elements are distributed to the first batches.
 *
 * @param {string[]} emails List of candidate email strings
 * @param {number} numBatches Number of batches (N)
 * @returns {string[][]} Array of N arrays containing candidate emails
 */
export const splitCandidatesIntoBatches = (emails, numBatches) => {
    if (!emails || emails.length === 0 || numBatches <= 0) {
        return Array.from({ length: Math.max(1, numBatches) }, () => []);
    }

    const n = emails.length;
    const k = Math.floor(n / numBatches);
    const m = n % numBatches;
    const batches = [];

    let startIndex = 0;
    for (let i = 0; i < numBatches; i++) {
        // First 'm' batches get an extra element
        const batchSize = i < m ? k + 1 : k;
        batches.push(emails.slice(startIndex, startIndex + batchSize));
        startIndex += batchSize;
    }

    return batches;
};

/**
 * Generates a secure time-bound JWT token for a candidate.
 *
 * @param {string} interviewId ID of the InterviewSession
 * @param {string} candidateEmail Email of the candidate
 * @param {string} candidateName Full name of the candidate
 * @param {string} groupId The batch ID or group code (e.g. 'A', 'B', 'C')
 * @param {Date|number} startTime DateTime object or numeric timestamp (seconds) for nbf (Not Before)
 * @param {Date|number} endTime DateTime object or numeric timestamp (seconds) for exp (Expiration)
 * @returns {string} Signed JWT token string
 */
export const generateCandidateToken = (interviewId, candidateEmail, candidateName, groupId, startTime, endTime) => {
    // Normalize start and end times to epoch timestamps (in seconds)
    const nbf = startTime instanceof Date ? Math.floor(startTime.getTime() / 1000) : Number(startTime);
    const exp = endTime instanceof Date ? Math.floor(endTime.getTime() / 1000) : Number(endTime);

    const payload = {
        interview_id: interviewId,
        email: candidateEmail,
        name: candidateName,
        group_id: groupId,
        nbf: nbf,
        exp: exp
    };

    // If no JWT_SECRET is available, provide a fallback for local testing
    const secretKey = process.env.JWT_SECRET || 'shr-scale-jwt-super-secret-key-2026';

    return jwt.sign(payload, secretKey, { algorithm: 'HS256' });
};
