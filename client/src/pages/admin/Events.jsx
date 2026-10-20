import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiCalendar,
  HiPlus,
  HiPencilSquare,
  HiTrash,
  HiMapPin,
  HiClock,
  HiArrowPath,
  HiListBullet,
  HiSquares2X2,
  HiChevronLeft,
  HiChevronRight,
  HiSparkles,
  HiCheck,
  HiStar,
  HiBuildingOffice2,
} from 'react-icons/hi2';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  getYear,
} from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';

// Pre-defined Indian and Tamil Annual Festivals (Year 2026 reference)
const STANDARD_FESTIVALS = [
  { title: 'New Year Day Celebration', month: 0, day: 1, type: 'Celebration', description: 'Community welcome celebration for the New Year' },
  { title: 'Pongal / Makar Sankranti', month: 0, day: 14, type: 'Harvest Festival', description: 'Traditional Pongal boiling ceremony & community kolam' },
  { title: 'Mattu Pongal / Uzhavar Thirunal', month: 0, day: 15, type: 'Festival', description: 'Thanksgiving to cattle and farmers' },
  { title: 'Republic Day Celebration & Flag Hoisting', month: 0, day: 26, type: 'National', description: 'Flag hoisting ceremony at layout park' },
  { title: 'Maha Shivaratri', month: 1, day: 15, type: 'Festival', description: 'Special evening cultural prayers' },
  { title: 'Holi Festival of Colors', month: 2, day: 4, type: 'Cultural', description: 'Organic color celebrations in community ground' },
  { title: 'Ugadi / Telugu New Year', month: 2, day: 19, type: 'Festival', description: 'New year celebration for residents' },
  { title: 'Eid-ul-Fitr (Ramzan)', month: 2, day: 21, type: 'Religious', description: 'Eid community greeting & sweet distribution' },
  { title: 'Good Friday', month: 3, day: 3, type: 'Observance', description: 'Special prayers observance' },
  { title: 'Tamil New Year (Puthandu) & Vishu', month: 3, day: 14, type: 'New Year', description: 'Traditional Tamil New Year community celebration' },
  { title: 'Bakrid / Eid al-Adha', month: 4, day: 28, type: 'Religious', description: 'Sacred Islamic festival of sacrifice' },
  { title: 'Muharram', month: 5, day: 26, type: 'Observance', description: 'Islamic New Year observance' },
  { title: 'Independence Day & Sports Meet', month: 7, day: 15, type: 'National', description: 'Flag hoisting, kids sports games and prize distribution' },
  { title: 'Krishna Janmashtami', month: 8, day: 4, type: 'Cultural', description: 'Uriyadi and kids fancy dress celebration' },
  { title: 'Ganesh / Vinayagar Chaturthi', month: 8, day: 14, type: 'Festival', description: 'Eco-friendly clay Ganesha pooja in community center' },
  { title: 'Milad-un-Nabi (Eid-e-Milad)', month: 8, day: 25, type: 'Religious', description: 'Prophet Birthday celebration' },
  { title: 'Gandhi Jayanti Cleanliness Drive', month: 9, day: 2, type: 'National', description: 'Swachh Layout community clean-up drive' },
  { title: 'Ayudha Pooja & Saraswati Pooja', month: 9, day: 19, type: 'Pooja', description: 'Tools, vehicles and layout machinery pooja' },
  { title: 'Vijayadashami / Dussehra', month: 9, day: 20, type: 'Festival', description: 'Triumph of good over evil celebration' },
  { title: 'Deepavali / Diwali Festival of Lights', month: 10, day: 8, type: 'Festival', description: 'Diyas lighting, green fireworks and sweets exchange' },
  { title: 'Guru Nanak Jayanti', month: 10, day: 24, type: 'Religious', description: 'Prakash Utsav community observance' },
  { title: 'Christmas Eve & Carol Gathering', month: 11, day: 24, type: 'Celebration', description: 'Carol singing and tree lighting' },
  { title: 'Christmas Celebration', month: 11, day: 25, type: 'Festival', description: 'Christmas feast and gift exchange for layout children' },
  { title: 'New Year Eve Countdown', month: 11, day: 31, type: 'Celebration', description: 'Year-end community dinner & midnight countdown' },
];

export default function AdminEvents() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Super Admin Association Filter
  const [associations, setAssociations] = useState([]);
  const [selectedAssociationFilter, setSelectedAssociationFilter] = useState('all');

  // View Mode: 'month' (Single month - Main preference) | 'year' (Full 12-month calendar) | 'list' (Table)
  const [viewMode, setViewMode] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isFestivalModalOpen, setIsFestivalModalOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventToView, setEventToView] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    end_date: '',
    location: '',
    association_id: 'all',
  });

  const [submitting, setSubmitting] = useState(false);

  // Load associations for super_admin
  useEffect(() => {
    if (user?.role === 'super_admin') {
      api.get('/associations')
        .then((res) => {
          const list = res.data?.data || res.data || [];
          setAssociations(Array.isArray(list) ? list : []);
        })
        .catch((err) => console.warn('Could not load associations for events:', err));
    }
  }, [user?.role]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ limit: '500' });
      if (user?.role === 'super_admin' && selectedAssociationFilter !== 'all') {
        queryParams.append('association_id', selectedAssociationFilter);
      }
      const res = await api.get(`/events?${queryParams.toString()}`);
      const raw = res.data?.data || res.data || [];
      setEvents(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load events:', err);
      toast.error('Failed to load association events');
    } finally {
      setLoading(false);
    }
  }, [user?.role, selectedAssociationFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Open Create Modal
  const handleOpenCreate = (prefilledDate = null) => {
    if (!isAdmin) return;
    const defaultDateStr = prefilledDate
      ? format(prefilledDate, "yyyy-MM-dd'T'10:00")
      : format(new Date(), "yyyy-MM-dd'T'10:00");

    setFormData({
      title: '',
      description: '',
      event_date: defaultDateStr,
      end_date: '',
      location: 'Association Community Hall / Layout Ground',
      association_id: selectedAssociationFilter !== 'all' ? selectedAssociationFilter : 'all',
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal (Admins)
  const handleOpenEdit = (evt) => {
    setSelectedEvent(evt);
    setFormData({
      title: evt.title || '',
      description: evt.description || '',
      event_date: evt.event_date ? new Date(evt.event_date).toISOString().slice(0, 16) : '',
      end_date: evt.end_date ? new Date(evt.end_date).toISOString().slice(0, 16) : '',
      location: evt.location || '',
    });
    setIsEditModalOpen(true);
  };

  // Open Event (Dispatches to Edit for Admins, or View Details for Members)
  const handleOpenEvent = (evt) => {
    if (isAdmin) {
      handleOpenEdit(evt);
    } else {
      setEventToView(evt);
      setIsViewModalOpen(true);
    }
  };

  // Submit Create Event
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.event_date) {
      toast.error('Event title and start date are required');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        event_date: new Date(formData.event_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        location: formData.location.trim(),
      };

      if (user?.role === 'super_admin') {
        payload.association_id = formData.association_id || 'all';
      }

      const res = await api.post('/events', payload);

      toast.success(res.data?.message || 'Event added to community calendar!');
      setIsCreateModalOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Event
  const handleEditEvent = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setSubmitting(true);
      await api.put(`/events/${selectedEvent.id}`, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        event_date: new Date(formData.event_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        location: formData.location.trim(),
      });

      toast.success('Calendar event updated successfully!');
      setIsEditModalOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      setSubmitting(true);
      await api.delete(`/events/${eventToDelete.id}`);
      toast.success('Event removed from calendar');
      setIsDeleteConfirmOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete event');
    } finally {
      setSubmitting(false);
    }
  };

  // Save / Sync All Standard Festivals to Calendar DB
  const handleSyncFestivals = async () => {
    try {
      setSubmitting(true);
      toast.loading(`Syncing all annual festivals for ${selectedYear}...`, { id: 'fest-sync' });

      let addedCount = 0;
      for (const fest of STANDARD_FESTIVALS) {
        const festDate = new Date(selectedYear, fest.month, fest.day, 9, 0, 0);

        // Check if already in events
        const exists = events.some(
          (e) =>
            e.title.toLowerCase().includes(fest.title.toLowerCase()) &&
            new Date(e.event_date).getFullYear() === selectedYear
        );

        if (!exists) {
          const festPayload = {
            title: fest.title,
            description: `${fest.description} (${fest.type})`,
            event_date: festDate.toISOString(),
            end_date: null,
            location: 'Community Hall / Layout Grounds',
          };
          if (user?.role === 'super_admin') {
            festPayload.association_id = selectedAssociationFilter !== 'all' ? selectedAssociationFilter : 'all';
          }
          await api.post('/events', festPayload);
          addedCount++;
        }
      }

      toast.success(
        addedCount > 0
          ? `Successfully saved ${addedCount} festivals to ${selectedYear} calendar!`
          : `All standard festivals already exist in the calendar for ${selectedYear}!`,
        { id: 'fest-sync' }
      );
      setIsFestivalModalOpen(false);
      fetchEvents();
    } catch (err) {
      console.error('Failed to sync festivals:', err);
      toast.error('Failed to save some festivals', { id: 'fest-sync' });
    } finally {
      setSubmitting(false);
    }
  };

  // DataTable columns for 'list' view
  const columns = useMemo(() => {
    const baseCols = [
      {
        header: 'Event / Festival Title',
        accessor: 'title',
        sortable: true,
        render: (title, row) => (
          <div
            onClick={() => handleOpenEvent(row)}
            className="cursor-pointer hover:text-primary-600 transition"
            title="Click to view details"
          >
            <span className="font-bold text-gray-900 block text-xs hover:underline">{title}</span>
            {row.description && (
              <span className="text-[11px] text-gray-500 line-clamp-1">{row.description}</span>
            )}
          </div>
        ),
      },
      {
        header: 'Start Date & Time',
        accessor: 'event_date',
        sortable: true,
        render: (d) => (
          <span className="text-xs font-semibold text-gray-800">
            {d ? format(new Date(d), 'dd MMM yyyy, hh:mm a') : '—'}
          </span>
        ),
      },
      {
        header: 'Location',
        accessor: 'location',
        sortable: true,
        render: (loc) => (
          <span className="text-xs text-gray-700 flex items-center gap-1">
            <HiMapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="truncate max-w-xs">{loc || 'Community Grounds'}</span>
          </span>
        ),
      },
    ];

    if (user?.role === 'super_admin') {
      baseCols.splice(1, 0, {
        header: 'Association',
        accessor: 'association_name',
        sortable: true,
        render: (name) => (
          <span className="inline-flex items-center text-[11px] font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded border border-primary-200">
            {name || 'All Associations'}
          </span>
        ),
      });
    }

    if (isAdmin) {
      baseCols.push({
        header: 'Actions',
        align: 'right',
        render: (_, row) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => handleOpenEdit(row)}
              title="Edit / Change Event"
              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            >
              <HiPencilSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEventToDelete(row);
                setIsDeleteConfirmOpen(true);
              }}
              title="Delete Event"
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <HiTrash className="w-4 h-4" />
            </button>
          </div>
        ),
      });
    }

    return baseCols;
  }, [isAdmin]);

  // Helper: Month name array
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiCalendar className="w-7 h-7 text-primary-600" />
            Community Events & Full Year Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            12-Month Annual Calendar with All Pre-Loaded Festivals, Layout Celebrations, and Admin Save/Edit Capability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Month (Main Preference) | Full Year (12M) | Table */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === 'month'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <HiSquares2X2 className="w-4 h-4" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === 'year'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <HiCalendar className="w-4 h-4" />
              <span>Full Year (12M)</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === 'list'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <HiListBullet className="w-4 h-4" />
              <span>Table</span>
            </button>
          </div>

          {/* Super Admin Association Filter */}
          {user?.role === 'super_admin' && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              <HiBuildingOffice2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <select
                value={selectedAssociationFilter}
                onChange={(e) => setSelectedAssociationFilter(e.target.value)}
                className="text-xs bg-transparent border-0 font-bold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
                title="Filter events by association"
              >
                <option value="all">🌐 All Associations (Platform-Wide)</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city || 'Tamil Nadu'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sync Festivals Button (Admins) */}
          {isAdmin && (
            <button
              onClick={() => setIsFestivalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 transition"
            >
              <HiSparkles className="w-4 h-4 text-amber-600" />
              <span>Manage Festivals</span>
            </button>
          )}

          {/* Create Event Button (Admins) */}
          {isAdmin && (
            <button
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <HiPlus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: FULL YEAR 12-MONTH CALENDAR GRID
         ========================================================================= */}
      {viewMode === 'year' && (
        <div className="space-y-6">
          {/* Year Navigator Bar */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
                title="Previous Year"
              >
                <HiChevronLeft className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-extrabold text-gray-900">
                Year {selectedYear} Community Calendar
              </h2>

              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
                title="Next Year"
              >
                <HiChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedYear(new Date().getFullYear())}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200"
              >
                Current Year ({new Date().getFullYear()})
              </button>

              <button
                onClick={handleSyncFestivals}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <HiSparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Save All Festivals for {selectedYear}</span>
              </button>
            </div>
          </div>

          {/* 12 Months Grid (3 columns on desktop, 12 mini calendars) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {months.map((mName, mIdx) => {
              const monthDate = new Date(selectedYear, mIdx, 1);
              const mStart = startOfWeek(startOfMonth(monthDate));
              const mEnd = endOfWeek(endOfMonth(monthDate));

              // Find events in this month
              const monthEvents = events.filter((e) => {
                const ed = new Date(e.event_date);
                return ed.getFullYear() === selectedYear && ed.getMonth() === mIdx;
              });

              // Generate days
              const days = [];
              let day = mStart;
              while (day <= mEnd) {
                days.push(day);
                day = addDays(day, 1);
              }

              return (
                <div
                  key={mName}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col justify-between hover:border-primary-200 hover:shadow-md transition"
                >
                  <div>
                    {/* Month Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                      <button
                        onClick={() => {
                          setCurrentMonth(monthDate);
                          setViewMode('month');
                        }}
                        className="text-sm font-extrabold text-gray-900 hover:text-primary-600 transition"
                      >
                        {mName}
                      </button>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                        {monthEvents.length} events
                      </span>
                    </div>

                    {/* Day of Week Labels */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 mb-1">
                      <span>S</span>
                      <span>M</span>
                      <span>T</span>
                      <span>W</span>
                      <span>T</span>
                      <span>F</span>
                      <span>S</span>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 text-center text-xs gap-y-1">
                      {days.map((d, dIdx) => {
                        const isCurrentM = isSameMonth(d, monthDate);
                        const isToday = isSameDay(d, new Date());
                        const dayEvents = events.filter((e) => isSameDay(new Date(e.event_date), d));
                        const hasEvent = dayEvents.length > 0;

                        return (
                          <div
                            key={dIdx}
                            onClick={() => {
                              if (hasEvent) {
                                handleOpenEvent(dayEvents[0]);
                              } else if (isAdmin) {
                                handleOpenCreate(d);
                              }
                            }}
                            title={
                              hasEvent
                                ? dayEvents.map((e) => e.title).join(', ')
                                : isAdmin
                                ? `Click to add event on ${format(d, 'dd MMM yyyy')}`
                                : format(d, 'dd MMM yyyy')
                            }
                            className={`h-7 w-7 mx-auto rounded-lg flex flex-col items-center justify-center ${
                              isAdmin || hasEvent ? 'cursor-pointer' : 'cursor-default'
                            } text-[11px] transition relative ${
                              !isCurrentM
                                ? 'text-gray-300'
                                : isToday
                                ? 'bg-primary-600 text-white font-bold'
                                : hasEvent
                                ? 'bg-amber-100 text-amber-900 font-bold hover:bg-amber-200'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span>{format(d, 'd')}</span>
                            {hasEvent && !isToday && (
                              <span className="w-1.5 h-1.5 bg-amber-600 rounded-full absolute bottom-0.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Month's Highlights / Festivals List */}
                  <div className="mt-3 pt-2 border-t border-gray-100 space-y-1 max-h-24 overflow-y-auto">
                    {monthEvents.length === 0 ? (
                      <span className="text-[10px] text-gray-400 italic block">No events scheduled</span>
                    ) : (
                      monthEvents.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenEvent(evt)}
                          className="flex items-center justify-between text-[11px] p-1 rounded hover:bg-gray-50 cursor-pointer text-gray-800"
                        >
                          <span className="truncate max-w-[140px] font-medium">• {evt.title}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {format(new Date(evt.event_date), 'dd MMM')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: SINGLE MONTH DETAILED INTERACTIVE CALENDAR
         ========================================================================= */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <HiChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <HiChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Month Day Headers */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-xl overflow-hidden text-center text-xs font-bold text-gray-700">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
              <div key={d} className="bg-gray-50 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Month Days Cell Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-b-xl overflow-hidden">
            {(() => {
              const mStart = startOfWeek(startOfMonth(currentMonth));
              const mEnd = endOfWeek(endOfMonth(currentMonth));
              const cells = [];
              let curDay = mStart;

              while (curDay <= mEnd) {
                const dayToRender = curDay;
                const isCurMonth = isSameMonth(dayToRender, currentMonth);
                const isToday = isSameDay(dayToRender, new Date());
                const dayEvents = events.filter((e) => isSameDay(new Date(e.event_date), dayToRender));

                cells.push(
                  <div
                    key={dayToRender.toISOString()}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        handleOpenEvent(dayEvents[0]);
                      } else if (isAdmin) {
                        handleOpenCreate(dayToRender);
                      }
                    }}
                    className={`min-h-[95px] p-1.5 bg-white ${
                      isAdmin || dayEvents.length > 0 ? 'cursor-pointer hover:bg-primary-50/20' : 'cursor-default'
                    } transition flex flex-col justify-between ${
                      !isCurMonth ? 'bg-gray-50/60 text-gray-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday ? 'bg-primary-600 text-white' : 'text-gray-800'
                        }`}
                      >
                        {format(dayToRender, 'd')}
                      </span>
                    </div>

                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[60px]">
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvent(evt);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold truncate bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition cursor-pointer"
                          title={evt.title}
                        >
                          🎉 {evt.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
                curDay = addDays(curDay, 1);
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: TABLE / AGENDA LIST VIEW
         ========================================================================= */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <DataTable
            columns={columns}
            data={events}
            loading={loading}
            searchPlaceholder="Search events or festivals by title, description, location..."
            emptyTitle="No events scheduled"
            emptyDescription="Click 'Add Event' or 'Manage Festivals' to add celebrations to the calendar."
          />
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / CREATE EVENT
         ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Event / Festival to Community Calendar"
        size="md"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          {/* Target Association for Super Admin */}
          {user?.role === 'super_admin' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Target Association *
              </label>
              <select
                value={formData.association_id}
                onChange={(e) => setFormData({ ...formData, association_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white font-medium"
              >
                <option value="all">📢 All Associations (Broadcast to all communities)</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.city || 'Tamil Nadu'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Select "All Associations" to schedule this event across all community layouts.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Event / Festival Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pongal Celebration, Annual General Meeting..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Venue / Location
            </label>
            <input
              type="text"
              placeholder="e.g. Community Hall / Layout Central Park"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description / Celebration Schedule
            </label>
            <textarea
              rows={3}
              placeholder="Provide program agenda, dress code, potluck details, or festival significance..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Save to Calendar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL: EDIT / MODIFY EVENT OR FESTIVAL
         ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit / Change Event or Festival"
        size="md"
      >
        <form onSubmit={handleEditEvent} className="space-y-4">
          {selectedEvent?.association_name && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg border border-primary-200 text-xs font-semibold">
              <HiBuildingOffice2 className="w-3.5 h-3.5" />
              <span>Association: {selectedEvent.association_name}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setEventToDelete(selectedEvent);
                setIsEditModalOpen(false);
                setIsDeleteConfirmOpen(true);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800"
            >
              Delete Event
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL: MANAGE & PRE-POPULATE ANNUAL FESTIVALS
         ========================================================================= */}
      <Modal
        isOpen={isFestivalModalOpen}
        onClose={() => setIsFestivalModalOpen(false)}
        title={`Pre-Configured Annual Festivals (${STANDARD_FESTIVALS.length})`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Click <strong>"Save All to Calendar"</strong> to pre-populate and save all major Indian, Tamil, and national festivals for <strong>Year {selectedYear}</strong> into your community database. You can freely edit dates or details at any time.
          </p>

          <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {STANDARD_FESTIVALS.map((fest, idx) => {
              const festDate = new Date(selectedYear, fest.month, fest.day);
              const isAlreadyAdded = events.some(
                (e) =>
                  e.title.toLowerCase().includes(fest.title.toLowerCase()) &&
                  new Date(e.event_date).getFullYear() === selectedYear
              );

              return (
                <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <span className="font-bold text-xs text-gray-900 block">{fest.title}</span>
                    <span className="text-[11px] text-gray-500">
                      {format(festDate, 'dd MMMM yyyy')} • {fest.type}
                    </span>
                  </div>

                  {isAlreadyAdded ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                      <HiCheck className="w-3.5 h-3.5" /> Saved
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                      Ready to Sync
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsFestivalModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSyncFestivals}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <HiSparkles className="w-4 h-4 text-amber-300" />
              <span>Save All to Year {selectedYear} Calendar</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* EVENT DETAILS MODAL (READ-ONLY FOR RESIDENT MEMBERS) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={eventToView?.title || 'Community Event Details'}
        size="md"
      >
        {eventToView && (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50/70 border border-primary-100 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-700 bg-primary-100/60 px-2.5 py-0.5 rounded-full inline-block">
                Community Celebration
              </span>
              {eventToView.association_name && (
                <div className="flex items-center gap-1.5 text-xs text-primary-700 font-semibold pt-0.5">
                  <HiBuildingOffice2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                  <span>{eventToView.association_name}</span>
                </div>
              )}
              <h3 className="text-base font-extrabold text-gray-900">{eventToView.title}</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-600 pt-1">
                <span className="flex items-center gap-1.5 font-semibold text-primary-800">
                  <HiClock className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  {eventToView.event_date ? format(new Date(eventToView.event_date), 'EEEE, dd MMMM yyyy, hh:mm a') : 'TBD'}
                </span>
                {eventToView.location && (
                  <span className="flex items-center gap-1.5 font-medium text-gray-700">
                    <HiMapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                    {eventToView.location}
                  </span>
                )}
              </div>
            </div>

            {eventToView.description && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Event Details & Program Notes
                </label>
                <p className="text-xs text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                  {eventToView.description}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove Event from Calendar"
        message={`Are you sure you want to remove "${eventToDelete?.title}" from the association calendar?`}
        confirmText="Delete Event"
        isDestructive
        loading={submitting}
      />
    </div>
  );
}
