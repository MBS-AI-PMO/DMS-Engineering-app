/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { guidelinesData as staticGuidelines } from '../data/guidelinesData';
import { fetchGuidelines } from '../utils/api';
import { normalizeGuideline } from '../utils/guidelineUtils';

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
          const normalized = data.map(g => normalizeGuideline(g));
          setGuidelines(normalized);
          setActiveTab(normalized[0].service_id || normalized[0].id);
        } else {
          // If API returns empty, use static data
          const mappedStatic = staticGuidelines.map(g => normalizeGuideline({ ...g, service_id: g.id }));
          setGuidelines(mappedStatic);
          setActiveTab(mappedStatic[0].service_id || mappedStatic[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch guidelines:', err);
        // Fallback to static data on error
        const mappedStatic = staticGuidelines.map(g => normalizeGuideline({ ...g, service_id: g.id }));
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
                                {(table.headers || []).map((header, hIdx) => (
                                  <th key={hIdx}>{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(table.rows || []).map((row, rIdx) => (
                                <tr key={rIdx}>
                                  {(table.headers || []).map((header, hIdx) => (
                                    <td key={hIdx}>{row[header] || '-'}</td>
                                  ))}
                                </tr>
                              ))}
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

