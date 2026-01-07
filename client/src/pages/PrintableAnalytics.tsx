import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import formsService, { FormData } from '../services/formsService';
import { LoadingSpinner } from '../components/ui';
import { PrintableAnalyticsReport } from '../components/analytics/PrintableAnalyticsReport';
import { AnalyticsData } from '../types/analytics';

const PrintableAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<FormData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formId) {
      loadFormData(formId);
    }
  }, [formId]);

  useEffect(() => {
    if (form && analytics && !generating) {
      // Auto-generate PDF after data is loaded
      setTimeout(() => {
        generatePDF();
      }, 1000); // Give the page time to render
    }
  }, [form, analytics]);

  const loadFormData = async (id: string) => {
    try {
      setLoading(true);
      const formData = await formsService.getForm(id);
      setForm(formData);
      setAnalytics((formData as any).analytics || null);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Error loading form:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!contentRef.current || !form) return;

    try {
      setGenerating(true);

      const options = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: `${form.title.replace(/[^a-z0-9]/gi, '_')}_Analytics_Report.pdf`,
        html2canvas: { 
          scale: 1
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(options).from(contentRef.current).save();

      // Close the window after download
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF');
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
        <p className="ml-3 text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-gray-900 font-medium">Generating PDF...</p>
        <p className="mt-2 text-sm text-gray-600">This may take a few moments. The window will close after download.</p>
      </div>
    );
  }

  if (error || !form || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error || 'Analytics data not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" ref={contentRef}>
      <PrintableAnalyticsReport form={form} analytics={analytics} />
    </div>
  );
};

export default PrintableAnalytics;
