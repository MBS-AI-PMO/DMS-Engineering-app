/** A costing tab's title, a short explanation and its tools on the right. */
export default function TabIntro({ title, children, actions }) {
    return (
        <div className="ck-intro">
            <div className="ck-intro-text">
                <h2 className="ak-card-title">{title}</h2>
                {children && <p className="ak-hint">{children}</p>}
            </div>
            {actions && <div className="ak-row-actions">{actions}</div>}
        </div>
    );
}
