import React, { useEffect } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Quote = () => {
    useEffect(() => {
        document.body.classList.add('light-mode');
        return () => {
            document.body.classList.remove('light-mode');
        };
    }, []);

    return (
        <div className="quote-container light-mode fadeIn">
            <div className="quote-content slideUp">
                <div className="success-icon animate-scale">
                    <CheckCircle size={80} color="#e31b23" />
                </div>
                <h1 className="fadeIn-delay-1">Quote Ready</h1>
                <p className="quote-id fadeIn-delay-1">Reference: Q82-1718-0092</p>

                <div className="quote-details fadeIn-delay-2">
                    <div className="detail-item">
                        <span>Project:</span>
                        <strong>Custom CAD Part</strong>
                    </div>
                    <div className="detail-item">
                        <span>Price:</span>
                        <strong>$245.00</strong>
                    </div>
                </div>

                <div className="quote-actions fadeIn-delay-3">
                    <button className="btn-download">Download Quote PDF</button>
                    <button className="btn-approve">Proceed to Checkout</button>
                </div>

                <Link to="/get-instant-pricing" className="back-link fadeIn-delay-3">
                    <ArrowLeft size={16} /> Back to Upload
                </Link>
            </div>
        </div>
    );
};

export default Quote;
