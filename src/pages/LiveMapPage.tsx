import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriorityLabel, StatusLabel, formatShortDate } from '../components/StatusLabels';
import { usePortal } from '../context/PortalContext';
import type { ComplaintCategory, ComplaintStatus, PriorityLevel } from '../types/civic';

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

export const LiveMapPage: React.FC = () => {
  const { complaints, departments } = usePortal();
  const [wardFilter, setWardFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | 'All'>('All');
  const [severityFilter, setSeverityFilter] = useState<PriorityLevel | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'All'>('All');
  const [showDensityLayer, setShowDensityLayer] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const densityLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByIdRef = useRef<Record<string, L.CircleMarker>>({});

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])),
    [departments]
  );

  const uniqueWards = useMemo(
    () => Array.from(new Set(complaints.map((c) => c.ward))).sort(),
    [complaints]
  );

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (wardFilter !== 'All' && c.ward !== wardFilter) return false;
      if (departmentFilter !== 'All') {
        if (departmentFilter === 'unassigned' && c.assignedDepartmentId !== null) return false;
        if (departmentFilter !== 'unassigned' && c.assignedDepartmentId !== departmentFilter)
          return false;
      }
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
      if (severityFilter !== 'All' && c.priority !== severityFilter) return false;
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      return true;
    });
  }, [complaints, wardFilter, departmentFilter, categoryFilter, severityFilter, statusFilter]);

  const selectedComplaint = useMemo(
    () => filteredComplaints.find((c) => c.id === selectedId) || null,
    [filteredComplaints, selectedId]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    densityLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      densityLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const densityLayer = densityLayerRef.current;
    if (!map || !markersLayer || !densityLayer) return;

    markersLayer.clearLayers();
    densityLayer.clearLayers();
    markerByIdRef.current = {};

    if (showDensityLayer) {
      const wardGroups: Record<string, { lats: number[]; lngs: number[]; count: number }> = {};
      filteredComplaints.forEach((c) => {
        if (!wardGroups[c.ward]) {
          wardGroups[c.ward] = { lats: [], lngs: [], count: 0 };
        }
        wardGroups[c.ward].lats.push(c.coordinates.lat);
        wardGroups[c.ward].lngs.push(c.coordinates.lng);
        wardGroups[c.ward].count += 1;
      });
      Object.entries(wardGroups).forEach(([wardName, grp]) => {
        const avgLat = grp.lats.reduce((a, b) => a + b, 0) / grp.count;
        const avgLng = grp.lngs.reduce((a, b) => a + b, 0) / grp.count;
        L.circle([avgLat, avgLng], {
          radius: 320 + grp.count * 120,
          color: '#0044B3',
          weight: 1,
          opacity: 0.35,
          fillColor: '#0044B3',
          fillOpacity: 0.08,
        })
          .bindTooltip(`${wardName}: ${grp.count} issue(s)`, { direction: 'top' })
          .addTo(densityLayer);
      });
    }

    filteredComplaints.forEach((c) => {
      const color =
        c.status === 'Resolved'
          ? '#10B981'
          : c.priority === 'Critical' || c.status === 'Escalated'
          ? '#EF4444'
          : c.priority === 'High' || c.status === 'Pending'
          ? '#F59E0B'
          : '#0044B3';

      const deptName = c.assignedDepartmentId
        ? deptMap[c.assignedDepartmentId]?.name || 'Assigned'
        : 'Unassigned';

      const marker = L.circleMarker([c.coordinates.lat, c.coordinates.lng], {
        radius: c.priority === 'Critical' ? 9 : 7,
        color: '#FFFFFF',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92,
      });

      const popupEl = document.createElement('div');
      popupEl.style.minWidth = '210px';
      popupEl.style.fontFamily = 'Inter, sans-serif';

      const idEl = document.createElement('div');
      idEl.style.fontSize = '11px';
      idEl.style.fontWeight = '600';
      idEl.style.color = '#0044B3';
      idEl.textContent = c.id;

      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '12px';
      titleEl.style.fontWeight = '600';
      titleEl.style.color = '#1E293B';
      titleEl.style.marginTop = '2px';
      titleEl.textContent = c.title;

      const locEl = document.createElement('div');
      locEl.style.fontSize = '11px';
      locEl.style.color = '#64748B';
      locEl.style.marginTop = '4px';
      locEl.textContent = `Location: ${c.ward}`;

      const metaEl = document.createElement('div');
      metaEl.style.fontSize = '11px';
      metaEl.style.color = '#64748B';
      metaEl.textContent = `Priority: ${c.priority} · Status: ${c.status}`;

      const deptEl = document.createElement('div');
      deptEl.style.fontSize = '11px';
      deptEl.style.color = '#64748B';
      deptEl.textContent = `Department: ${deptName}`;

      popupEl.append(idEl, titleEl, locEl, metaEl, deptEl);

      marker.bindPopup(popupEl);
      marker.on('click', () => {
        setSelectedId(c.id);
      });
      marker.addTo(markersLayer);
      markerByIdRef.current[c.id] = marker;
    });
  }, [filteredComplaints, deptMap, showDensityLayer]);

  const focusComplaint = (id: string, lat: number, lng: number) => {
    setSelectedId(id);
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 15, { animate: true });
      const marker = markerByIdRef.current[id];
      if (marker) marker.openPopup();
    }
  };

  const resetView = () => {
    setWardFilter('All');
    setDepartmentFilter('All');
    setCategoryFilter('All');
    setSeverityFilter('All');
    setStatusFilter('All');
    setSelectedId(null);
    mapRef.current?.setView(DEFAULT_CENTER, 11, { animate: true });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">Live Civic Issues Map</h2>
          <p className="text-xs text-[#64748B]">
            Geotagged municipal complaint monitoring powered by OpenStreetMap & Leaflet
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowDensityLayer((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              showDensityLayer
                ? 'border-[#0044B3] bg-[#EFF6FF] text-[#0044B3]'
                : 'border-[#E2E8F0] bg-white text-[#1E293B]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Ward Density Overlay</span>
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Bar */}
      <section className="grid grid-cols-1 gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <select
          aria-label="Ward filter"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Wards</option>
          {uniqueWards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <select
          aria-label="Department filter"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Departments</option>
          <option value="unassigned">Unassigned</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Category filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ComplaintCategory | 'All')}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Categories</option>
          <option value="Road Maintenance">Road Maintenance</option>
          <option value="Sanitation">Sanitation</option>
          <option value="Water Supply">Water Supply</option>
          <option value="Electricity">Electricity</option>
          <option value="Drainage">Drainage</option>
          <option value="Public Infrastructure">Public Infrastructure</option>
        </select>

        <select
          aria-label="Severity filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as PriorityLevel | 'All')}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Priorities / Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ComplaintStatus | 'All')}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Statuses</option>
          <option value="New">New</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Escalated">Escalated</option>
          <option value="Resolved">Resolved</option>
        </select>
      </section>

      {/* Equal-Height Map + Side List Split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden">
          <div
            ref={mapContainerRef}
            className="h-[540px] w-full flex-1 bg-[#F8FAFC]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#FAFBFC] px-4 py-2.5 text-[11px] text-[#64748B]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Critical / Escalated
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> High / Pending
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0044B3]" /> Medium / In Progress
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" /> Resolved
              </span>
            </div>
            <span className="font-mono-tabular">
              {filteredComplaints.length} geotagged issue(s) shown
            </span>
          </div>
        </div>

        <aside className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-4 flex flex-col h-[582px]">
          <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold text-[#1E293B]">Geotagged Issues</h3>
            <span className="font-mono-tabular text-xs text-[#64748B]">
              {filteredComplaints.length}
            </span>
          </div>

          {selectedComplaint && (
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFF] p-3.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-tabular text-xs font-semibold text-[#0044B3]">
                  {selectedComplaint.id}
                </span>
                <Link
                  to={`/complaints/${selectedComplaint.id}`}
                  className="rounded bg-[#0044B3] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#003591]"
                >
                  Open Record
                </Link>
              </div>
              <div className="mt-1 text-xs font-medium text-[#1E293B]">
                {selectedComplaint.title}
              </div>
              <div className="mt-1 text-[11px] text-[#64748B]">
                {selectedComplaint.address} ·{' '}
                {selectedComplaint.assignedDepartmentId
                  ? deptMap[selectedComplaint.assignedDepartmentId]?.name
                  : 'Unassigned'}
              </div>
            </div>
          )}

          <div className="flex-1 divide-y divide-[#E2E8F0] overflow-y-auto">
            {filteredComplaints.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B]">
                No geotagged issues match current filters.
              </div>
            ) : (
              filteredComplaints.map((c) => {
                const isActive = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    onClick={() => focusComplaint(c.id, c.coordinates.lat, c.coordinates.lng)}
                    className={`cursor-pointer px-4 py-3 transition-colors ${
                      isActive ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-semibold text-[#0044B3]">
                        {c.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <PriorityLabel priority={c.priority} />
                        <StatusLabel status={c.status} />
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#1E293B] line-clamp-1">
                      {c.title}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>{c.ward}</span>
                      <span>{formatShortDate(c.reportedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
