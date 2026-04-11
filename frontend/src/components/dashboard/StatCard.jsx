import React from 'react';

export default function StatCard({ icon: Icon, label, value, subtitle, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div className="stat-card-icon">
          <Icon size={20} />
        </div>
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`stat-card-trend stat-card-trend-${trend.type}`}>
          {trend.value}
        </div>
      )}
    </div>
  );
}
