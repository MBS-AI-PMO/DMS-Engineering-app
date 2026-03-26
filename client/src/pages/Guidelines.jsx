/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { guidelinesData } from '../data/guidelinesData';

const Guidelines = () => {
  const [activeTab, setActiveTab] = useState(guidelinesData[0].id);

  const activeData = guidelinesData.find(item => item.id === activeTab);

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
          {guidelinesData.map((item) => (
            <button
              key={item.id}
              className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
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
                  <span>Always review your design before finalizing your order.</span>
                </div>
              </div>

              <div className="detail-body">
                <p className="intro-text">{activeData.content}</p>

                {activeData.tables ? (
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
                              {table.rows.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  {Object.values(row).map((val, vIdx) => (
                                    <td key={vIdx}>{val}</td>
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

