import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Container, Button, Row, Col, Form, Spinner, Badge, Alert } from 'react-bootstrap';
import { FaEye, FaTimes, FaWaveSquare, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import Lottie from 'lottie-react';
import animationData from './live.json';

// React.lazy replacement for dynamic import
const MapWithNoSSR = lazy(() => import('./realtime_search_map'));

const SearchComponent = ({ 
    firstSelection, 
    setFirstSelection, 
    selectedStations, 
    setSelectedStations, 
    buoyOptions, 
    setBuoyOptions, 
    loading, 
    setLoading, 
    error, 
    setError, 
    setDashboardGenerated 
}) => {
    const MAX_SELECTION = 8;

    const firstOptions = ['Wave Buoy', 'Tide Gauge'];

    const fetchBuoyData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                'https://opmgeoserver.gem.spc.int/geoserver/spc/wfs?service=WFS&version=1.1.0&request=GetFeature&typeNames=spc:wave_buoy_pac&outputFormat=application/json&srsName=epsg:4326'
            );
            if (!response.ok) {
                throw new Error('Failed to fetch buoy data');
            }
            const data = await response.json();
            
            const activeBuoys = data.features
                .filter(feature => feature.properties.is_active === "TRUE")
                .map(feature => ({
                    spotter_id: feature.properties.spotter_id,
                    label: `${feature.properties.country_co} - ${feature.properties.spotter_id}`,
                    coordinates: feature.geometry.coordinates,
                    latest_date: feature.properties.latest_dat,
                    owner: feature.properties.owner,
                    country_co: feature.properties.country_co,
                    is_active: feature.properties.is_active === "TRUE"
                }));
            
            setBuoyOptions(activeBuoys);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching buoy data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (firstSelection === 'Wave Buoy') {
            fetchBuoyData();
        } else {
            setBuoyOptions([]);
            setSelectedStations([]);
        }
    }, [firstSelection]);

    const handleStationSelect = (e) => {
        const selectedId = e.target.value;
        if (selectedId && !selectedStations.includes(selectedId)) {
            if (selectedStations.length < MAX_SELECTION) {
                setSelectedStations([...selectedStations, selectedId]);
            }
        }
        e.target.value = '';
    };

    const removeStation = (stationId) => {
        setSelectedStations(selectedStations.filter(id => id !== stationId));
    };

    const handleSubmit = () => {
        setDashboardGenerated(true);
        //document.documentElement.style.overflow = 'hidden';
        //document.body.style.overflow = 'hidden';
    };

    const getStationDetails = (stationId) => {
        return buoyOptions.find(b => b.spotter_id === stationId) || {};
    };

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                    <Lottie
                        animationData={animationData}
                        style={{ width: 30, height: 30 }}
                        loop={true}
                    />
                    <h1 className="mb-0" style={{color:'grey'}}>Real-Time Ocean Monitoring</h1>
                </div>
                <Button 
                    variant="primary" 
                    onClick={handleSubmit}
                    disabled={!firstSelection || selectedStations.length === 0 || loading}
                >
                    {loading ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Loading...
                        </>
                    ) : (
                        <>
                            Generate Dashboard
                            <FaArrowRight size={15} style={{marginTop:-2, marginLeft:3}} className="me-2" />
                        </>
                    )}
                </Button>
            </div>
            
            <div className="bg-light p-4 rounded shadow-sm mb-4">
                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group controlId="firstDropdown">
                            <Form.Label>Monitoring Type</Form.Label>
                            <Form.Select 
                                value={firstSelection}
                                onChange={(e) => setFirstSelection(e.target.value)}
                            >
                                <option value="">Select an option</option>
                                {firstOptions.map((option, index) => (
                                    <option 
                                        key={index} 
                                        value={option}
                                        disabled={option === 'Tide Gauge'}
                                    >
                                        {option}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="secondDropdown">
                            <Form.Label>Station Selection (Max {MAX_SELECTION})</Form.Label>
                            {loading ? (
                                <div className="d-flex align-items-center">
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    <span>Loading buoys...</span>
                                </div>
                            ) : (
                                <>
                                    <Form.Select 
                                        onChange={handleStationSelect}
                                        disabled={!firstSelection || loading || selectedStations.length >= MAX_SELECTION}
                                    >
                                        <option value="">
                                            {selectedStations.length >= MAX_SELECTION 
                                                ? `Maximum ${MAX_SELECTION} stations selected` 
                                                : 'Select stations (multiple)'}
                                        </option>
                                        {buoyOptions
                                            .filter(buoy => !selectedStations.includes(buoy.spotter_id))
                                            .map((buoy, index) => (
                                                <option key={index} value={buoy.spotter_id}>
                                                    {buoy.label}
                                                </option>
                                            ))}
                                    </Form.Select>
                                    {selectedStations.length >= MAX_SELECTION && (
                                        <Alert variant="info" className="mt-2 p-2">
                                            Maximum of {MAX_SELECTION} stations can be selected
                                        </Alert>
                                    )}
                                    <div className="mt-2 d-flex flex-wrap gap-2">
                                        {selectedStations.map(stationId => (
                                            <Badge key={stationId} pill bg="primary" className="d-flex align-items-center">
                                                {getStationDetails(stationId).label}
                                                <FaTimes 
                                                    className="ms-2 cursor-pointer" 
                                                    onClick={() => removeStation(stationId)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Form.Group>
                        {error && <div className="text-danger small mt-2">{error}</div>}
                    </Col>
                </Row>
            </div>

            {/* Map Container */}
            <div className="rounded shadow-sm" style={{ height: '500px', backgroundColor: '#e9ecef' }}>
                <Suspense fallback={<div>Loading map...</div>}>
                    <MapWithNoSSR 
                        buoyOptions={buoyOptions}
                        selectedStations={selectedStations}
                    />
                </Suspense>
            </div>
        </Container>
    );
};

export default SearchComponent;