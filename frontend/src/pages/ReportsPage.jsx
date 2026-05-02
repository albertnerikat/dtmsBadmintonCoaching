import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import PeriodSelector from '../components/reports/PeriodSelector';
import FilterSection from '../components/reports/FilterSection';
import ViewToggle from '../components/reports/ViewToggle';
import ReportTable from '../components/reports/ReportTable';
import ReportCards from '../components/reports/ReportCards';
import DetailPanel from '../components/reports/DetailPanel';
import { exportAsCSV, exportAsPDF } from '../lib/exportReports';

export default function ReportsPage() {
  // State
  const [periodType, setPeriodType] = useState('calendar_month');
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hideFreOnly, setHideFreOnly] = useState(false);
  const [ageCategory, setAgeCategory] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Responsive check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate report
  async function generateReport() {
    setLoading(true);
    setError('');
    try {
      let startDate, endDate;

      if (periodType === 'calendar_month') {
        const [year, month] = monthYear.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${lastDay}`;
      } else {
        startDate = customStart;
        endDate = customEnd;
        if (!startDate || !endDate) {
          setError('Please select both start and end dates');
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        hide_free_only: hideFreOnly,
      });
      if (ageCategory) params.append('age_category', ageCategory);

      const data = await api.get(`/reports/period-outstanding?${params}`);
      setReportData(data);
      setSelectedStudentId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Export handlers
  function handleExportCSV() {
    if (!reportData) return;
    exportAsCSV(reportData);
  }

  function handleExportPDF() {
    if (!reportData) return;
    exportAsPDF(reportData);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Period-based outstanding balance report</p>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        periodType={periodType}
        setPeriodType={setPeriodType}
        monthYear={monthYear}
        setMonthYear={setMonthYear}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        onGenerate={generateReport}
        loading={loading}
      />

      {/* Filters & View Toggle */}
      {reportData && (
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <FilterSection
            hideFreOnly={hideFreOnly}
            setHideFreOnly={setHideFreOnly}
            ageCategory={ageCategory}
            setAgeCategory={setAgeCategory}
            onFilterChange={generateReport}
            isMobile={isMobile}
          />
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Generating report...</div>
      ) : reportData ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Total Students</div>
              <div className="text-xl md:text-2xl font-bold">{reportData.summary.total_students}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Previous Balance</div>
              <div className="text-xl md:text-2xl font-bold">${reportData.summary.total_previous_balance.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Period Outstanding</div>
              <div className="text-xl md:text-2xl font-bold">${reportData.summary.total_period_outstanding.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm">
              <div className="text-xs md:text-sm text-gray-500 mb-1">Total Outstanding</div>
              <div className="text-xl md:text-2xl font-bold text-red-600">${reportData.summary.total_outstanding.toFixed(2)}</div>
            </div>
          </div>

          {/* Report Table / Cards */}
          {isMobile ? (
            <ReportCards
              students={reportData.students}
              viewMode={viewMode}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          ) : (
            <ReportTable
              students={reportData.students}
              viewMode={viewMode}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          )}

          {/* Detail Panel */}
          {selectedStudentId && viewMode === 'detailed' && (
            <DetailPanel
              studentId={selectedStudentId}
              period={reportData.period}
              onClose={() => setSelectedStudentId(null)}
              isMobile={isMobile}
            />
          )}

          {/* Export Buttons */}
          <div className="flex flex-col md:flex-row gap-3 md:justify-end mt-6">
            <button
              onClick={handleExportCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm md:text-base"
            >
              Export as CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm md:text-base"
            >
              Export as PDF
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Generate a report to get started
        </div>
      )}
    </div>
  );
}
