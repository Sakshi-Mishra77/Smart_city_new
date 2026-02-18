import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock, Filter, AlertCircle, Users, RotateCcw } from 'lucide-react';
import { OfficialDashboardLayout } from '@/components/layout/OfficialDashboardLayout';
import { SettingsModal } from '@/components/SettingsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnalyticsDashboard, useTickets, useTrends } from '@/hooks/use-data';
import { ticketService, Ticket } from '@/services/tickets';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authService } from '@/services/auth';

const statusBadge: Record<string, string> = {
  open: 'badge-info',
  in_progress: 'badge-warning',
  resolved: 'badge-success',
  verified: 'badge-success'
};

interface AssignmentDraft {
  name: string;
  phone: string;
  photoBase64: string;
  photoName: string;
}

const OfficialDashboard = () => {
  const { pathname } = useLocation();
  const user = authService.getCurrentUser();
  const isHeadSupervisor = user?.userType === 'head_supervisor';
  const normalizedPath = pathname.startsWith('/official/supervisor')
    ? pathname.replace('/official/supervisor', '/official')
    : pathname;
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentImageDialogOpen, setIncidentImageDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [query, setQuery] = useState('');
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [assigneeEditorOpen, setAssigneeEditorOpen] = useState<Record<string, boolean>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [submittingAssignId, setSubmittingAssignId] = useState<string | null>(null);
  const [submittingStatusId, setSubmittingStatusId] = useState<string | null>(null);

  const { tickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useTickets();
  const { data: analytics, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalyticsDashboard();
  const { data: trends, loading: trendsLoading } = useTrends(14);

  const filteredTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((t) =>
      [t.title, t.description, t.category, t.location, t.status, t.assignedTo, t.assigneeName, t.assigneePhone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [tickets, query]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const parts = result.split(',');
        const base64 = parts.length > 1 ? parts[1] : '';
        if (!base64) {
          reject(new Error('Invalid image'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Unable to read image'));
      reader.readAsDataURL(file);
    });
  };

  const getAssignmentDraft = (ticketId: string, fallbackName = '', fallbackPhone = ''): AssignmentDraft => {
    return assignmentDrafts[ticketId] || {
      name: fallbackName,
      phone: fallbackPhone,
      photoBase64: '',
      photoName: '',
    };
  };

  const setAssignmentDraft = (ticketId: string, updates: Partial<AssignmentDraft>, fallbackName = '', fallbackPhone = '') => {
    setAssignmentDrafts((prev) => {
      const current = prev[ticketId] || {
        name: fallbackName,
        phone: fallbackPhone,
        photoBase64: '',
        photoName: '',
      };
      return {
        ...prev,
        [ticketId]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const openAssigneeEditor = (ticketId: string, fallbackName = '', fallbackPhone = '') => {
    setAssignmentDraft(ticketId, {}, fallbackName, fallbackPhone);
    setAssigneeEditorOpen((prev) => ({ ...prev, [ticketId]: true }));
  };

  const closeAssigneeEditor = (ticketId: string) => {
    setAssigneeEditorOpen((prev) => ({ ...prev, [ticketId]: false }));
  };

  const stats = useMemo(() => {
    const total = analytics?.tickets.total || tickets.length;
    const open = analytics?.tickets.open || tickets.filter((t) => t.status === 'open').length;
    const inProgress = analytics?.tickets.inProgress || tickets.filter((t) => t.status === 'in_progress').length;
    const resolved = analytics?.tickets.resolved || tickets.filter((t) => t.status === 'resolved').length;
    return { total, open, inProgress, resolved };
  }, [analytics, tickets]);

  const currentSection = useMemo(() => {
    if (normalizedPath.includes('/official/tickets')) return 'tickets';
    if (normalizedPath.includes('/official/personnel')) return 'personnel';
    if (normalizedPath.includes('/official/analytics')) return 'analytics';
    if (normalizedPath.includes('/official/alerts')) return 'alerts';
    return 'overview';
  }, [normalizedPath]);

  const handleAssigneePhoto = async (ticketId: string, file: File | null, fallbackName = '', fallbackPhone = '') => {
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setAssignmentDraft(ticketId, { photoBase64: base64, photoName: file.name }, fallbackName, fallbackPhone);
    } catch {
      toast({ title: 'Invalid Photo', description: 'Upload a valid image file', variant: 'destructive' });
    }
  };

  const handleAssign = async (ticketId: string, fallbackName = '', fallbackPhone = '', hasExistingPhoto = false) => {
    const draft = getAssignmentDraft(ticketId, fallbackName, fallbackPhone);
    const name = draft.name.trim();
    const phoneDigits = draft.phone.replace(/\D/g, '');

    if (!name) {
      toast({ title: 'Name Required', description: 'Enter personnel name', variant: 'destructive' });
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      toast({ title: 'Phone Required', description: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }
    if (!draft.photoBase64 && !hasExistingPhoto) {
      toast({ title: 'Photo Required', description: 'Upload personnel photo', variant: 'destructive' });
      return;
    }

    setSubmittingAssignId(ticketId);
    try {
      const response = await ticketService.assignTicket(ticketId, {
        assigneeName: name,
        assigneePhone: phoneDigits,
        assignedTo: name,
        assigneePhoto: draft.photoBase64 || undefined,
      });
      if (response.success) {
        const updated = response.data;
        toast({
          title: fallbackName ? 'Personnel Changed' : 'Ticket Assigned',
          description: 'Assignment updated successfully',
        });
        setAssignmentDraft(ticketId, {
          name: updated?.assigneeName || updated?.assignedTo || name,
          phone: updated?.assigneePhone || phoneDigits,
          photoBase64: '',
          photoName: '',
        });
        closeAssigneeEditor(ticketId);
        await refetchTickets();
        await refetchAnalytics();
      } else {
        toast({ title: 'Assign Failed', description: response.error || 'Unable to assign', variant: 'destructive' });
      }
    } finally {
      setSubmittingAssignId(null);
    }
  };

  const handleStatus = async (ticketId: string, nextStatus?: string) => {
    const targetStatus = nextStatus || statusDrafts[ticketId] || '';
    if (!targetStatus) {
      toast({ title: 'Status Required', description: 'Select a status', variant: 'destructive' });
      return;
    }
    setSubmittingStatusId(ticketId);
    try {
      const response = await ticketService.updateStatus(ticketId, { status: targetStatus });
      if (response.success) {
        const finalStatus = response.data?.status || targetStatus;
        toast({
          title: finalStatus === 'open' ? 'Ticket Reopened' : 'Status Updated',
          description:
            targetStatus === 'verified'
              ? 'Verified ticket moved to IN_PROGRESS'
              : finalStatus === 'open'
                ? 'Ticket moved back to OPEN'
                : 'Ticket status updated',
        });
        setStatusDrafts((prev) => ({ ...prev, [ticketId]: '' }));
        await refetchTickets();
        await refetchAnalytics();
      } else {
        toast({ title: 'Update Failed', description: response.error || 'Unable to update status', variant: 'destructive' });
      }
    } finally {
      setSubmittingStatusId(null);
    }
  };

  const openIncidentDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIncidentImageDialogOpen(false);
    setIncidentDialogOpen(true);
  };

  const formatStatus = (value: string) => value.replace('_', ' ').toUpperCase();

  return (
    <>
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} isOfficial={true} />
      <OfficialDashboardLayout onSettingsClick={() => setShowSettings(true)}>
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {isHeadSupervisor ? 'Head Supervisor Command Center' : 'Department Official Console'}
              </h1>
              <p className="text-muted-foreground">
                {isHeadSupervisor
                  ? 'Coordinate cross-departmental operations, analytics, and staffing in real time.'
                  : 'Track assigned incidents, update progress, and collaborate with your supervisor team.'}
              </p>
            </div>
          </div>

          {(ticketsError || analyticsError) && (
            <div className="p-4 bg-card rounded-xl border border-border text-destructive">
              {ticketsError || analyticsError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-card rounded-xl border border-border">
              <div className="text-sm text-muted-foreground">Total Tickets</div>
              <div className="text-2xl font-heading font-bold text-foreground">{stats.total}</div>
            </div>
            <div className="p-4 bg-card rounded-xl border border-border">
              <div className="text-sm text-muted-foreground">Open</div>
              <div className="text-2xl font-heading font-bold text-info">{stats.open}</div>
            </div>
            <div className="p-4 bg-card rounded-xl border border-border">
              <div className="text-sm text-muted-foreground">In Progress</div>
              <div className="text-2xl font-heading font-bold text-warning">{stats.inProgress}</div>
            </div>
            <div className="p-4 bg-card rounded-xl border border-border">
              <div className="text-sm text-muted-foreground">Resolved</div>
              <div className="text-2xl font-heading font-bold text-success">{stats.resolved}</div>
            </div>
          </div>

          {(currentSection === 'overview' || currentSection === 'analytics') && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="font-heading font-semibold text-foreground mb-3">Issue Category Distribution</h2>
                {analyticsLoading && <div className="text-sm text-muted-foreground">Loading analytics...</div>}
                {!analyticsLoading && (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.byCategory || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <h2 className="font-heading font-semibold text-foreground mb-3">14-Day Trend</h2>
                {trendsLoading && <div className="text-sm text-muted-foreground">Loading trends...</div>}
                {!trendsLoading && (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="created" stroke="hsl(var(--warning))" strokeWidth={2} />
                        <Line type="monotone" dataKey="resolved" stroke="hsl(var(--success))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}

          {(currentSection === 'overview' || currentSection === 'personnel') && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h2 className="font-heading font-semibold text-foreground mb-3">Worker Productivity</h2>
              {analyticsLoading && <div className="text-sm text-muted-foreground">Loading worker metrics...</div>}
              {!analyticsLoading && (analytics?.workerProductivity || []).length === 0 && (
                <div className="text-sm text-muted-foreground">No assigned work yet</div>
              )}
              <div className="space-y-2">
                {(analytics?.workerProductivity || []).map((worker) => (
                  <div key={worker.worker} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-foreground">{worker.worker}</div>
                      <div className="text-sm text-muted-foreground">{worker.resolutionRate}% resolved</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                      <div>Total: {worker.total}</div>
                      <div>Open: {worker.open}</div>
                      <div>In Progress: {worker.inProgress}</div>
                      <div>Resolved: {worker.resolved}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(currentSection === 'overview' || currentSection === 'tickets' || currentSection === 'alerts') && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Filter className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tickets by title, category, assignee, location"
                    className="pl-9"
                  />
                </div>
              </div>

              {ticketsLoading && <div className="text-sm text-muted-foreground">Loading tickets...</div>}
              {!ticketsLoading && filteredTickets.length === 0 && <div className="text-sm text-muted-foreground">No tickets found</div>}

              <div className="space-y-3">
                {filteredTickets.map((ticket) => {
                  const existingName = ticket.assigneeName || ticket.assignedTo || '';
                  const existingPhone = ticket.assigneePhone || '';
                  const assignmentDraft = getAssignmentDraft(ticket.id, existingName, existingPhone);
                  const isResolved = ticket.status === 'resolved';
                  const hasAssignee = !!existingName;
                  const isEditingAssignee = !!assigneeEditorOpen[ticket.id];

                  return (
                    <div key={ticket.id} className="p-4 rounded-xl border border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{ticket.title}</span>
                            <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", statusBadge[ticket.status] || 'badge-info')}>
                              {ticket.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{ticket.category} | {ticket.priority} priority</div>
                          <div className="text-xs text-muted-foreground">{ticket.location}</div>
                          <div className="text-xs text-muted-foreground">
                            Assigned: {existingName || 'Unassigned'}{existingPhone ? ` (${existingPhone})` : ''}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => openIncidentDetails(ticket)}
                          >
                            Show Incident
                          </Button>
                        </div>
                      </div>

                      {isResolved ? (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-border p-2">
                          <span className="text-sm text-muted-foreground">Resolved ticket. Use reopen if needed.</span>
                          <Button
                            variant="outline"
                            onClick={() => handleStatus(ticket.id, 'open')}
                            disabled={submittingStatusId === ticket.id}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reopen
                          </Button>
                        </div>
                      ) : (
                        <div className="grid lg:grid-cols-2 gap-3 mt-3">
                          <div className="space-y-2">
                            {!isEditingAssignee ? (
                              <>
                                <div className="rounded-md border border-border p-2">
                                  {hasAssignee ? (
                                    <div className="text-sm text-foreground">
                                      <span className="font-medium">{existingName}</span>
                                      {existingPhone ? ` | ${existingPhone}` : ''}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No personnel assigned yet.</div>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => openAssigneeEditor(ticket.id, existingName, existingPhone)}
                                  disabled={submittingAssignId === ticket.id}
                                >
                                  <Users className="h-4 w-4 mr-1" />
                                  {hasAssignee ? 'Change Personnel' : 'Assign Personnel'}
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="grid sm:grid-cols-3 gap-2">
                                  <Input
                                    placeholder="Personnel name"
                                    value={assignmentDraft.name}
                                    onChange={(e) => setAssignmentDraft(ticket.id, { name: e.target.value }, existingName, existingPhone)}
                                  />
                                  <Input
                                    placeholder="Phone number"
                                    value={assignmentDraft.phone}
                                    inputMode="numeric"
                                    onChange={(e) => setAssignmentDraft(ticket.id, { phone: e.target.value }, existingName, existingPhone)}
                                  />
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleAssigneePhoto(ticket.id, e.target.files?.[0] || null, existingName, existingPhone)}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleAssign(ticket.id, existingName, existingPhone, !!ticket.assigneePhotoUrl)}
                                    disabled={submittingAssignId === ticket.id}
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    {hasAssignee ? 'Save Personnel' : 'Assign Personnel'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => closeAssigneeEditor(ticket.id)}
                                    disabled={submittingAssignId === ticket.id}
                                  >
                                    Cancel
                                  </Button>
                                  {assignmentDraft.photoName && (
                                    <span className="text-xs text-muted-foreground truncate">{assignmentDraft.photoName}</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <select
                              className="h-10 px-3 rounded-md border border-input bg-background text-sm w-full"
                              value={statusDrafts[ticket.id] || ''}
                              disabled={!hasAssignee || submittingStatusId === ticket.id}
                              onChange={(e) => {
                                setStatusDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }));
                              }}
                            >
                              <option value="">Set status</option>
                              <option value="verified">VERIFIED</option>
                              <option value="resolved">RESOLVED</option>
                            </select>
                            <Button
                              onClick={() => handleStatus(ticket.id)}
                              disabled={submittingStatusId === ticket.id || !hasAssignee}
                            >
                              <ClipboardList className="h-4 w-4 mr-1" />
                              Update
                            </Button>
                          </div>
                          {!hasAssignee && (
                            <p className="text-xs text-muted-foreground">Assign personnel first to update status.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </OfficialDashboardLayout>
      <Dialog
        open={incidentDialogOpen}
        onOpenChange={(open) => {
          setIncidentDialogOpen(open);
          if (!open) {
            setIncidentImageDialogOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
            <DialogDescription>
              Full report information for review and action.
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground mb-2">Incident Image</div>
                {selectedTicket.assigneePhotoUrl ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setIncidentImageDialogOpen(true)}
                  >
                    <img
                      src={selectedTicket.assigneePhotoUrl}
                      alt={selectedTicket.assigneeName || selectedTicket.assignedTo || 'Incident image'}
                      className="w-full h-44 rounded-md object-cover border border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-2">Click image to view larger</p>
                  </button>
                ) : (
                  <div className="h-28 rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
                    No image available
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{selectedTicket.title}</h3>
                  <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", statusBadge[selectedTicket.status] || 'badge-info')}>
                    {formatStatus(selectedTicket.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTicket.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Incident ID</div>
                  <div className="text-sm font-medium text-foreground">{selectedTicket.id}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <div className="text-sm font-medium text-foreground">{selectedTicket.category}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Priority</div>
                  <div className="text-sm font-medium text-foreground">{selectedTicket.priority?.toUpperCase() || 'N/A'}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Reported By</div>
                  <div className="text-sm font-medium text-foreground">{selectedTicket.reportedBy || 'Unknown'}</div>
                </div>
                <div className="rounded-lg border border-border p-3 sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Location</div>
                  <div className="text-sm font-medium text-foreground">{selectedTicket.location || 'N/A'}</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Assigned Personnel</div>
                  <div className="text-sm font-medium text-foreground">
                    {selectedTicket.assigneeName || selectedTicket.assignedTo || 'Unassigned'}
                  </div>
                  {selectedTicket.assigneePhone && (
                    <div className="text-xs text-muted-foreground mt-1">{selectedTicket.assigneePhone}</div>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Incident Status</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      {selectedTicket.status === 'resolved' ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : selectedTicket.status === 'in_progress' ? (
                        <Clock className="h-5 w-5 text-warning" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-info" />
                      )}
                      <span className="text-foreground font-medium">{formatStatus(selectedTicket.status)}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Timeline</div>
                  <div className="text-xs text-muted-foreground">
                    Created: {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString() : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Updated: {selectedTicket.updatedAt ? new Date(selectedTicket.updatedAt).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={incidentImageDialogOpen} onOpenChange={setIncidentImageDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Incident Image</DialogTitle>
            <DialogDescription>Expanded view</DialogDescription>
          </DialogHeader>
          {selectedTicket?.assigneePhotoUrl ? (
            <img
              src={selectedTicket.assigneePhotoUrl}
              alt={selectedTicket.assigneeName || selectedTicket.assignedTo || 'Incident image'}
              className="w-full max-h-[70vh] object-contain rounded-md border border-border"
            />
          ) : (
            <div className="h-40 rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
              No image available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfficialDashboard;
