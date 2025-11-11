import React, { useState } from 'react';

const ProfileReviewPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    gpa: '',
    testType: 'SAT',
    testScore: '',
    intendedMajor: '',
    extracurriculars: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateMailtoLink = () => {
    const recipient = 'seethroughuniadmissions@gmail.com';
    const subject = `Profile Review Request for ${formData.name}`;
    const body = `
      Hello SeeThroughAdmissions Team,

      I would like to request a personalized profile review. Here are my details:

      - Name: ${formData.name}
      - Country of Residence: ${formData.country}
      - High School GPA: ${formData.gpa}
      - Standardized Test: ${formData.testType} - ${formData.testScore}
      - Intended Major(s): ${formData.intendedMajor}
      - Key Extracurricular Activities:
        ${formData.extracurriculars}

      Thank you for your assistance.

      Best,
      ${formData.name}
    `;
    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  
  const canSubmit = formData.name && formData.country && formData.gpa;

  return (
    <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold text-brand-dark mb-2">Get a Personalized Profile Review</h1>
          <p className="text-gray-600 mb-6">Fill out the form below. We'll help you generate a pre-filled email to send to our advisors for a personalized review of your chances at US universities.</p>
    
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm" />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country of Residence</label>
                <input type="text" name="country" id="country" value={formData.country} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label htmlFor="gpa" className="block text-sm font-medium text-gray-700">High School GPA (e.g., 3.8/4.0)</label>
                    <input type="text" name="gpa" id="gpa" value={formData.gpa} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm" />
                 </div>
                 <div>
                    <label htmlFor="testType" className="block text-sm font-medium text-gray-700">Test Type</label>
                    <select id="testType" name="testType" value={formData.testType} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm">
                        <option>SAT</option>
                        <option>ACT</option>
                        <option>IELTS</option>
                        <option>TOEFL</option>
                        <option>Not Taken</option>
                    </select>
                 </div>
                 <div>
                    <label htmlFor="testScore" className="block text-sm font-medium text-gray-700">Score</label>
                    <input type="text" name="testScore" id="testScore" value={formData.testScore} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm" />
                 </div>
            </div>

            <div>
                <label htmlFor="intendedMajor" className="block text-sm font-medium text-gray-700">Intended Major(s)</label>
                <input type="text" name="intendedMajor" id="intendedMajor" value={formData.intendedMajor} onChange={handleChange} placeholder="e.g., Computer Science, Economics" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm" />
            </div>

            <div>
                <label htmlFor="extracurriculars" className="block text-sm font-medium text-gray-700">Summarize your key extracurricular activities</label>
                <textarea id="extracurriculars" name="extracurriculars" rows={4} value={formData.extracurriculars} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm"></textarea>
            </div>
            
            <div className="text-right">
                <a 
                    href={canSubmit ? generateMailtoLink() : undefined}
                    className={`inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${canSubmit ? 'bg-brand-primary hover:bg-brand-dark' : 'bg-gray-400 cursor-not-allowed'}`}
                    aria-disabled={!canSubmit}
                    onClick={(e) => !canSubmit && e.preventDefault()}
                >
                    Generate Email Draft
                </a>
            </div>

          </form>
        </div>
    </div>
  );
};

export default ProfileReviewPage;