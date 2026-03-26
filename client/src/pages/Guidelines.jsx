/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { guidelinesData as staticGuidelines } from '../data/guidelinesData';
import { fetchGuidelines } from '../utils/api';

const Guidelines = () => {
  const [activeTab, setActiveTab] = useState(null);
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadGuidelines = async () => {
      try {
        setLoading(true);
        const data = await fetchGuidelines();
        if (data && data.length > 0) {
          setGuidelines(data);
          setActiveTab(data[0].service_id);
        } else {
          // If API returns empty, use static data
          setGuidelines(staticGuidelines.map(g => ({ ...g, service_id: g.id })));
          setActiveTab(staticGuidelines[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch guidelines:', err);
        // Fallback to static data on error
        const mappedStatic = staticGuidelines.map(g => ({ ...g, service_id: g.id }));
        setGuidelines(mappedStatic);
        setActiveTab(mappedStatic[0].service_id || mappedStatic[0].id);
        setError('Using offline guidelines data.');
      } finally {
        setLoading(false);
      }
    };

    loadGuidelines();
  }, []);

  const activeData = guidelines.find(item => (item.service_id || item.id) === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!activeData) return <div className="container p-10 text-center">No guidelines available.</div>;

  return (
    <div className="guidelines-page">
      {/* Hero Section */}
      <section className="guidelines-hero">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="hero-content"
          >
            <h1>Design & Manufacturing <span className="highlight">Guidelines</span></h1>
            <p>Ensure your CAD files are ready for perfect production with our comprehensive service specifications.</p>
          </motion.div>
        </div>
      </section>

      <div className="container guidelines-layout">
        {/* Sidebar */}
        <aside className="guidelines-sidebar">
          {guidelines.map((item) => (
            <button
              key={item.service_id || item.id}
              className={`sidebar-link ${activeTab === (item.service_id || item.id) ? 'active' : ''}`}
              onClick={() => setActiveTab(item.service_id || item.id)}
            >
              {item.title}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="guidelines-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="guidelines-detail"
            >
              <div className="detail-header">
                <h2>{activeData.title} Guidelines</h2>
                <div className="info-banner">
                  <Info size={18} />
                  <span>{error ? error : 'Always review your design before finalizing your order.'}</span>
                </div>
              </div>

              <div className="detail-body">
                <p className="intro-text">{activeData.content}</p>

                {activeData.tables && activeData.tables.length > 0 ? (
                  <div className="guidelines-tables">
                    {activeData.tables.map((table, tIdx) => (
                      <div key={tIdx} className="guideline-table-wrapper">
                        <h3 className="guideline-material-title">{table.material}</h3>
                        <div className="table-responsive">
                          <table className="guideline-table">
                            <thead>
                              <tr>
                                {table.headers ? (
                                  table.headers.map((header, hIdx) => (
                                    <th key={hIdx}>{header}</th>
                                  ))
                                ) : (
                                  <>
                                    <th>Thickness</th>
                                    <th>Min Flat Part Size</th>
                                    <th>Max Flat Part Size</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row, rIdx) => {
                                // Define the expected order of standard keys
                                const standardKeys = [
                                  'thickness', 't',
                                  'min_flat_part_size', 'minF', 'min',
                                  'max_flat_part_size', 'maxF', 'max'
                                ];

                                // Group values: first standard columns, then any extra columns
                                let values = [];

                                if (table.headers) {
                                  // If headers are provided, we'll try to match by index if row is array,
                                  // or just use Object.values if we can't be sure.
                                  // But if it's an object, we should try to be smart.
                                  values = Object.values(row);
                                } else {
                                  // Standard 3-column fallback: [Thickness, Min, Max]
                                  const t = row.thickness || row.t || '';
                                  const min = row.min || row.minF || row.min_flat_part_size || '';
                                  const max = row.max || row.maxF || row.max_flat_part_size || '';
                                  values = [t, min, max];

                                  // Add any extra keys that aren't the standard ones
                                  Object.keys(row).forEach(k => {
                                    if (!standardKeys.includes(k)) {
                                      values.push(row[k]);
                                    }
                                  });
                                }

                                return (
                                  <tr key={rIdx}>
                                    {values.map((val, vIdx) => (
                                      <td key={vIdx}>{val}</td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="requirements-section">
                    <h3>Key Requirements</h3>
                    <div className="requirements-grid">
                      {activeData.requirements?.map((req, index) => (
                        <div key={index} className="requirement-item">
                          <CheckCircle2 className="check-icon" size={20} />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Guidelines;

