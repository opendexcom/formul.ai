import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, AlertCircle, CheckCircle } from "lucide-react";
import { FormData, Question, QuestionType } from "../services/formsService";
import { Button, LoadingSpinner, Alert } from "../components/ui";

interface FormResponse {
  [questionId: string]:
    | string
    | number
    | string[]
    | boolean
    | { other: string }
    | null;
}

const PublicFormView: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData | null>(null);
  const [responses, setResponses] = useState<FormResponse>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 5;

  useEffect(() => {
    if (formId) {
      loadPublicForm(formId);
    }
  }, [formId]);

  const loadPublicForm = async (id: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}/public/forms/${id}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Form not found");
        } else if (response.status === 403) {
          throw new Error(
            "This form is not publicly available or is no longer accepting responses",
          );
        } else {
          throw new Error("Failed to load form");
        }
      }

      const formData = await response.json();
      setForm(formData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load form";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    questionId: string,
    value: string | number | string[] | boolean | { other: string },
  ) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const { [questionId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateForm = (): boolean => {
    if (!form) return false;

    const errors: Record<string, string> = {};

    form.questions.forEach((question) => {
      if (
        question.required &&
        (!responses[question.id] || responses[question.id] === "")
      ) {
        errors[question.id] = "This field is required";
      }

      // Add specific validation based on question type
      if (responses[question.id]) {
        switch (question.type) {
          case QuestionType.EMAIL:
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (
              typeof responses[question.id] === "string" &&
              !emailRegex.test(responses[question.id] as string)
            ) {
              errors[question.id] = "Please enter a valid email address";
            }
            break;
          case QuestionType.NUMBER:
            if (isNaN(Number(responses[question.id]))) {
              errors[question.id] = "Please enter a valid number";
            }
            break;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form || !validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"}/public/forms/${formId}/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            formId,
            responses,
            submittedAt: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit response: ${errorText}`);
      }

      await response.json();

      if (!response.ok) {
        throw new Error("Failed to submit response");
      }

      setSubmitted(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit response";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id] ?? "";
    const hasError = validationErrors[question.id];

    const inputClasses = `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      hasError ? "border-red-300" : "border-gray-300"
    }`;

    switch (question.type) {
      case QuestionType.TEXT:
        return (
          <input
            type="text"
            className={inputClasses}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );

      case QuestionType.TEXTAREA:
        return (
          <textarea
            className={inputClasses}
            rows={4}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );

      case QuestionType.EMAIL:
        return (
          <input
            type="email"
            className={inputClasses}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your email address"
          />
        );

      case QuestionType.NUMBER:
        return (
          <input
            type="number"
            className={inputClasses}
            value={value as string | number}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter a number"
          />
        );

      case QuestionType.DATE:
        return (
          <input
            type="date"
            className={inputClasses}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case QuestionType.TIME:
        return (
          <input
            type="time"
            className={inputClasses}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case QuestionType.MULTIPLE_CHOICE:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option}</span>
              </label>
            ))}
            {question.canBeOther && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value="__other__"
                  checked={
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value) &&
                    "other" in value
                  }
                  onChange={() => handleInputChange(question.id, { other: "" })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Other</span>
              </label>
            )}
            {typeof value === "object" &&
              value !== null &&
              !Array.isArray(value) &&
              "other" in value && (
                <div className="ml-6 mt-2">
                  <input
                    type="text"
                    className={inputClasses}
                    value={(value as { other: string }).other}
                    onChange={(e) =>
                      handleInputChange(question.id, { other: e.target.value })
                    }
                    placeholder="Please specify..."
                    autoFocus
                  />
                </div>
              )}
          </div>
        );

      case QuestionType.CHECKBOX:
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleInputChange(question.id, [
                        ...currentValues,
                        option,
                      ]);
                    } else {
                      handleInputChange(
                        question.id,
                        currentValues.filter((v) => v !== option),
                      );
                    }
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option}</span>
              </label>
            ))}
            {question.canBeOther && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value) &&
                    "other" in value
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange(question.id, { other: "" });
                    } else {
                      handleInputChange(question.id, []);
                    }
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Other</span>
              </label>
            )}
            {typeof value === "object" &&
              value !== null &&
              !Array.isArray(value) &&
              "other" in value && (
                <div className="ml-6 mt-2">
                  <input
                    type="text"
                    className={inputClasses}
                    value={(value as { other: string }).other}
                    onChange={(e) =>
                      handleInputChange(question.id, { other: e.target.value })
                    }
                    placeholder="Please specify..."
                    autoFocus
                  />
                </div>
              )}
          </div>
        );

      case QuestionType.DROPDOWN:
        return (
          <div className="space-y-3">
            <select
              className={inputClasses}
              value={
                typeof value === "object" && value !== null
                  ? "__other__"
                  : (value as string)
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__other__") {
                  handleInputChange(question.id, { other: "" });
                } else {
                  handleInputChange(question.id, val);
                }
              }}
            >
              <option value="">Select an option</option>
              {question.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
              {question.canBeOther && <option value="__other__">Other</option>}
            </select>
            {typeof value === "object" &&
              value !== null &&
              "other" in value && (
                <input
                  type="text"
                  className={inputClasses}
                  value={(value as { other: string }).other}
                  onChange={(e) =>
                    handleInputChange(question.id, { other: e.target.value })
                  }
                  placeholder="Please specify..."
                  autoFocus
                />
              )}
          </div>
        );

      case QuestionType.RATING:
        const minRating = Number(question.validation?.min?.value) || 1;
        const maxRating = Number(question.validation?.max?.value) || 5;
        const ratingRange = Array.from(
          { length: maxRating - minRating + 1 },
          (_, i) => minRating + i,
        );

        return (
          <div className="flex items-center space-x-1">
            {ratingRange.map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleInputChange(question.id, rating)}
                className={`w-8 h-8 ${
                  Number(value) >= rating ? "text-yellow-400" : "text-gray-300"
                } hover:text-yellow-400 transition-colors`}
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            className={inputClasses}
            value={value as string}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading form..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert type="error" message={error} className="mb-4" />
          <Button
            variant="secondary"
            onClick={() => navigate("/")}
            className="w-full"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Thank you!
            </h2>
            <p className="text-gray-600 mb-6">
              Your response has been submitted successfully.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate("/")}
              className="w-full"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const totalPages = Math.ceil(form.questions.length / questionsPerPage);
  const currentQuestions = form.questions
    .sort((a, b) => a.order - b.order)
    .slice(
      currentPage * questionsPerPage,
      (currentPage + 1) * questionsPerPage,
    );

  const progressPercentage = form.settings?.showProgressBar
    ? Math.round(((currentPage + 1) / Math.max(totalPages, 1)) * 100)
    : 0;

  return (
    <div
      className="min-h-screen p-8"
      style={{
        backgroundColor:
          form.settings?.customTheme?.backgroundColor || "#F9FAFB",
        fontFamily: form.settings?.customTheme?.fontFamily || "Inter",
      }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        {form.settings?.showProgressBar && totalPages > 1 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor:
                    form.settings?.customTheme?.primaryColor || "#3B82F6",
                }}
              />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Form Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-lg leading-relaxed">
                {form.description}
              </p>
            )}
          </div>

          {error && <Alert type="error" message={error} className="mb-6" />}

          {/* Questions */}
          {currentQuestions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No questions yet
              </h3>
              <p className="text-gray-500">This form has no questions.</p>
            </div>
          ) : (
            currentQuestions.map((question) => (
              <div
                key={question.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="mb-4">
                  <label className="block text-lg font-medium text-gray-900 mb-2">
                    {question.title}
                    {question.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {question.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {question.description}
                    </p>
                  )}
                </div>
                {renderQuestion(question)}
                {validationErrors[question.id] && (
                  <div className="flex items-center space-x-1 mt-3">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      {validationErrors[question.id]}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Navigation & Submit */}
          {currentQuestions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  {totalPages > 1 && currentPage > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Previous
                    </button>
                  )}
                </div>

                <div className="flex space-x-4">
                  {totalPages > 1 && currentPage < totalPages - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      className="px-6 py-2 text-white rounded-md hover:opacity-90"
                      style={{
                        backgroundColor:
                          form.settings?.customTheme?.primaryColor || "#3B82F6",
                      }}
                    >
                      Next
                    </button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      icon={Send}
                      loading={submitting}
                      disabled={submitting}
                      style={{
                        backgroundColor:
                          form.settings?.customTheme?.primaryColor,
                      }}
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PublicFormView;
