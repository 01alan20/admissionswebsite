import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";
import { submitContactRequest } from "../services/contactRequests";

const ContactHelpPage: React.FC = () => {
  const { user, studentProfile } = useOnboardingContext();
  const location = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [interests, setInterests] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [locationPreferences, setLocationPreferences] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and what you need help with.");
      return;
    }
    if (!consent) {
      setError("Please confirm that we can contact you about this request.");
      return;
    }

    setSubmitting(true);
    try {
      await submitContactRequest({
        name,
        email,
        phone,
        gradYear,
        gradeLevel,
        interests,
        budgetRange,
        locationPreferences,
        message,
        sourcePage: location.pathname || "/contact",
        userId: user?.id ?? null,
        profileSnapshot: studentProfile || null,
      });
      setSubmitted(true);
    } catch (_err) {
      setError("Something went wrong submitting your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 md:p-8">
        <h1 className="text-3xl font-bold text-brand-primary mb-4">Thanks for reaching out!</h1>
        <p className="text-gray-700 mb-4">
          A real person will review your information and get back to you within one week.
        </p>
        <p className="text-gray-600">
          You can keep exploring universities while we prepare a personalized response tailored to your goals.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 md:p-8">
      <h1 className="text-3xl font-bold text-brand-primary mb-4">Need Personalized Help?</h1>
      <p className="text-gray-700 mb-2">
        Share a bit about your situation and we&apos;ll review your profile and questions, then send you a tailored reply.
      </p>
      <p className="text-gray-700 mb-4">
        This service is <span className="font-semibold">100% free</span>. A real person will reply within one week.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            placeholder="Include country code if outside the US"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Graduation year</label>
            <input
              type="text"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
              placeholder="e.g., 2026"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current grade level</label>
            <input
              type="text"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
              placeholder="e.g., 11th grade"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interests or major ideas (optional)
          </label>
          <input
            type="text"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            placeholder="e.g., Computer Science, Business, Engineering"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget per year (optional)</label>
            <input
              type="text"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
              placeholder="e.g., up to $30,000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location preferences (optional)</label>
            <input
              type="text"
              value={locationPreferences}
              onChange={(e) => setLocationPreferences(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
              placeholder="e.g., East Coast, California, big city"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            What do you need help with? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            placeholder="Tell us about your situation, goals, and any specific questions you have."
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            id="contact-consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 text-brand-secondary border-gray-300 rounded"
          />
          <label htmlFor="contact-consent" className="text-sm text-gray-700">
            I agree that SeeThroughAdmissions can contact me about this request. We will not share your
            information outside this service.
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full md:w-auto px-6 py-2 rounded-md bg-brand-secondary text-white font-semibold hover:bg-brand-primary disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </div>
  );
};

export default ContactHelpPage;

