/**
 * ReviewDashboard.tsx
 * Human reviewer interface for MetaGuardian report approval
 * 
 * Features:
 * - List pending reports with risk badges
 * - View full report with flagged sections highlighted
 * - Approve/Reject/Request Revision
 * - De-identified context (no user PII shown to reviewer)
 */

import React, { useState, useEffect } from 'react';

interface FlaggedSection {
  dimension: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  text_excerpt: string;
}

interface LLMAnalysis {
  risk_level: 'SAFE' | 'CAUTION' | 'DANGEROUS';
  flagged_sections: FlaggedSection[];
  constitutional_violations: any[];
  requires_human_review: boolean;
  auto_safe_delivery: boolean;
  reviewer_guidance: string;
}

interface PendingReport {
  report_id: string;
  created_at: string;
  risk_level: string;
  flagged_sections_count: number;
  mode: 'preventive' | 'medical';
  key_themes: string[];
  user_journey_summary: string;
  llm_analysis: LLMAnalysis;
}

interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  auto_approval_rate: number;
}

interface ReportDetails extends PendingReport {
  report_html: string;
  groq_metadata: any;
  reviewer_notes?: string;
  reviewer_decision?: string;
}

const ReviewDashboard: React.FC = () => {
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetails | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch pending reports on mount
  useEffect(() => {
    fetchPendingReports();
    fetchStats();
  }, []);

  const fetchPendingReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/pending-reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending reports');
      }

      const data = await response.json();
      setPendingReports(data.pending_reports || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/review-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchReportDetails = async (reportId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/report-details/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch report details');
      }

      const data = await response.json();
      setSelectedReport(data);
      setReviewerNotes('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitDecision = async (decision: 'approve' | 'reject' | 'revise') => {
    if (!selectedReport) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/review-report/${selectedReport.report_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          decision,
          reviewer_notes: reviewerNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit decision');
      }

      // Refresh pending reports
      await fetchPendingReports();
      await fetchStats();
      setSelectedReport(null);
      setReviewerNotes('');
      alert(`Report ${decision}d successfully`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'SAFE': return 'bg-green-100 text-green-800 border-green-300';
      case 'CAUTION': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'DANGEROUS': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 font-bold';
      case 'HIGH': return 'text-orange-600 font-semibold';
      case 'MEDIUM': return 'text-yellow-600';
      case 'LOW': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛡️ MetaGuardian Review Dashboard
          </h1>
          <p className="text-gray-600">
            Human oversight for AI-generated health reports
          </p>
        </div>

        {/* Stats Panel */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending Review</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-sm text-gray-600">Rejected</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
              <div className="text-2xl font-bold text-amber-600">
                {(stats.auto_approval_rate * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">Auto-Approved</div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Reports List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Pending Reports ({pendingReports.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {pendingReports.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    ✅ No reports pending review
                  </div>
                ) : (
                  pendingReports.map((report) => (
                    <div
                      key={report.report_id}
                      onClick={() => fetchReportDetails(report.report_id)}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(report.risk_level)}`}>
                          {report.risk_level}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        {report.user_journey_summary.substring(0, 80)}...
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="capitalize">{report.mode}</span>
                        <span>{report.flagged_sections_count} flags</span>
                      </div>
                      {report.key_themes && report.key_themes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {report.key_themes.slice(0, 3).map((theme, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Report Details */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Report Review
                    </h2>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Risk Summary */}
                  <div className={`p-4 rounded-lg border ${getRiskColor(selectedReport.risk_level)} mb-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          Risk Level: {selectedReport.risk_level}
                        </div>
                        <div className="text-sm opacity-80">
                          {selectedReport.flagged_sections_count} flagged sections
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="capitalize">{selectedReport.mode} journey</div>
                        <div className="opacity-80">
                          {new Date(selectedReport.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LLM Guidance */}
                  {selectedReport.llm_analysis.reviewer_guidance && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <div className="font-semibold text-purple-900 mb-2">
                        🤖 Claude's Guidance:
                      </div>
                      <div className="text-sm text-purple-800">
                        {selectedReport.llm_analysis.reviewer_guidance}
                      </div>
                    </div>
                  )}

                  {/* Flagged Sections */}
                  {selectedReport.llm_analysis.flagged_sections.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        ⚠️ Flagged Content:
                      </h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedReport.llm_analysis.flagged_sections.map((section, idx) => (
                          <div
                            key={idx}
                            className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-semibold ${getSeverityColor(section.severity)}`}>
                                {section.severity}
                              </span>
                              <span className="text-xs text-gray-600">
                                {section.dimension}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 mb-1">
                              {section.explanation}
                            </div>
                            <div className="text-xs text-gray-500 italic bg-white p-2 rounded border border-gray-200">
                              "{section.text_excerpt}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Journey Context */}
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      📖 User Journey (De-identified):
                    </h3>
                    <div className="text-sm text-blue-800">
                      {selectedReport.user_journey_summary}
                    </div>
                    {selectedReport.key_themes && selectedReport.key_themes.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-blue-700 font-semibold mb-1">
                          Key Themes:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.key_themes.map((theme, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Full Report Preview */}
                <div className="p-6 border-b border-gray-200 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    📄 Full Report Preview:
                  </h3>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedReport.report_html }}
                  />
                </div>

                {/* Review Actions */}
                <div className="p-6 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Reviewer Decision:
                  </h3>
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder="Add notes for audit trail (optional)..."
                    className="w-full border border-gray-300 rounded-lg p-3 mb-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => submitDecision('approve')}
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white rounded-lg py-3 px-4 font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      ✅ Approve & Deliver
                    </button>
                    <button
                      onClick={() => submitDecision('reject')}
                      disabled={loading}
                      className="flex-1 bg-red-600 text-white rounded-lg py-3 px-4 font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      ❌ Reject (Don't Send)
                    </button>
                    <button
                      onClick={() => submitDecision('revise')}
                      disabled={loading}
                      className="flex-1 bg-amber-600 text-white rounded-lg py-3 px-4 font-semibold hover:bg-amber-700 disabled:opacity-50 transition"
                    >
                      🔄 Request Revision
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                ← Select a report from the list to review
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewDashboard;
