
import React, { useState } from 'react';
import SearchComponent from './searchComponent';
import RealtimeComponent from './realtimeComponent';
import './Monitor.css';

const Widget = () => {
    const [firstSelection, setFirstSelection] = useState('');
    const [selectedStations, setSelectedStations] = useState([]);
    const [buoyOptions, setBuoyOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dashboardGenerated, setDashboardGenerated] = useState(false);

    return (
        <div className="monitoring-container">
            {!dashboardGenerated ? (
                <SearchComponent
                    firstSelection={firstSelection}
                    setFirstSelection={setFirstSelection}
                    selectedStations={selectedStations}
                    setSelectedStations={setSelectedStations}
                    buoyOptions={buoyOptions}
                    setBuoyOptions={setBuoyOptions}
                    loading={loading}
                    setLoading={setLoading}
                    error={error}
                    setError={setError}
                    setDashboardGenerated={setDashboardGenerated}
                />
            ) : (
                <RealtimeComponent
                    selectedStations={selectedStations}
                    setDashboardGenerated={setDashboardGenerated}
                    buoyOptions={buoyOptions}
                    firstSelection={firstSelection}
                />
            )}
        </div>
    );
};

export default Widget;