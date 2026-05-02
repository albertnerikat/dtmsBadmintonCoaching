export default function PeriodSelector({
  periodType,
  setPeriodType,
  monthYear,
  setMonthYear,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onGenerate,
  loading,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Period Selection</h2>

      {/* Period Type Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType('calendar_month')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            periodType === 'calendar_month'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Calendar Month
        </button>
        <button
          onClick={() => setPeriodType('custom_range')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            periodType === 'custom_range'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Custom Dates
        </button>
      </div>

      {/* Calendar Month Selector */}
      {periodType === 'calendar_month' && (
        <div className="flex gap-3 mb-4 flex-col md:flex-row">
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Custom Date Range Selector */}
      {periodType === 'custom_range' && (
        <div className="flex gap-3 mb-4 flex-col md:flex-row">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-2">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-2">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
      >
        {loading ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
}
