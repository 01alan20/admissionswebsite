import React from "react";

const ProfileOnboardingPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-brand-dark mb-2">
          Make Your Profile
        </h1>
        <p className="text-gray-600 mb-6">
          Create a profile to track your progress and gain insights into your chosen
          universities.
        </p>

        <div className="mt-6 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">
            Profile onboarding and magic-link login are coming soon. For now, you can
            explore universities and tools without creating an account or logging in.
          </p>
          <button
            type="button"
            disabled
            className="px-5 py-2 rounded-md bg-gray-300 text-gray-600 text-sm font-semibold cursor-not-allowed"
          >
            Magic-link login coming soon
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileOnboardingPage;

