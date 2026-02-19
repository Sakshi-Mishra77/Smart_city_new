import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  RotateCcw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { OfficialDashboardLayout } from '@/components/layout/OfficialDashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTickets } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth';
import { Ticket, TicketLogEntry, ticketService } from '@/services/tickets';
import { usersService, WorkerAccount } from '@/services/users';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

type DashboardRole = 'department' | 'supervisor' | 'field_inspector' | 'worker';

const statusBadge: Record<string, string> = {
  open: 'badge-info',
  pending: 'badge-warning',
  in_progress: 'badge-warning',
  verified: 'badge-info',
  resolved: 'badge-success',
};

const roleDisplay: Record<DashboardRole, string> = {
  department: 'Department Dashboard',
  supervisor: 'Supervisor Dashboard',
  field_inspector: 'Field Inspector Dashboard',
  worker: 'Worker Dashboard',
};

const roleDescription: Record<DashboardRole, string> = {
  department: 'Resolve/reopen cases and review immutable official logbooks.',
  supervisor: 'Assign registered workers and verify field completion updates.',
  field_inspector: 'Submit daily progress updates before 6:00 PM IST.',
  worker: 'Track assigned tasks and submit on-ground work updates.',
};

const toRole = (value: string | undefined): DashboardRole => {
  const normalized = (value || '').trim().toLowerCase().replace('-', '_');
  if (normalized === 'supervisor') return 'supervisor';
  if (normalized === 'field_inspector') return 'field_inspector';
  if (normalized === 'worker') return 'worker';
  return 'department';
};

const formatDateTime = (value?: string) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatStatus = (value?: string) => {
  const text = (value || '').replace(/_/g, ' ').trim();
  if (!text) return 'UNKNOWN';
  return text.toUpperCase();
};

const logbookDetailText = (details: Record<string, unknown> | undefined): string => {
  if (!details || Object.keys(details).length === 0) return 'No extra details';
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ');
};

const ticketWorkerNames = (ticket: Ticket): string[] => {
  if (Array.isArray(ticket.assignees) && ticket.assignees.length > 0) {
    return ticket.assignees
      .map((row) => (row?.name || '').trim())
      .filter((value) => value.length > 0);
  }
  if (ticket.assigneeName) return [ticket.assigneeName];
  if (ticket.assignedTo) return [ticket.assignedTo];
  return [];
};

const ticketWorkerIds = (ticket: Ticket): string[] => {
  if (Array.isArray(ticket.assignees) && ticket.assignees.length > 0) {
    const ids = ticket.assignees
      .map((row) => (row?.workerId || '').trim())
      .filter((value) => value.length > 0);
    if (ids.length > 0) return ids;
  }
  if (Array.isArray(ticket.workerIds) && ticket.workerIds.length > 0) {
    return ticket.workerIds.map((value) => String(value || '').trim()).filter((value) => value.length > 0);
  }
  if (ticket.workerId) return [ticket.workerId];
  return [];
};

const OfficialDashboard = () => {
  const { pathname } = useLocation();
  const { toast } = useToast();
  const user = authService.getCurrentUser();
  const role = toRole(user?.officialRole);
  const isTicketsPage = pathname.startsWith('/official/tickets');
  const isReadOnlyDashboard = pathname.startsWith('/official/dashboard');

  const { tickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useTickets();
  const [query, setQuery] = useState('');

  const [workers, setWorkers] = useState<WorkerAccount[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [selectedWorkerByTicket, setSelectedWorkerByTicket] = useState<Record<string, string[]>>({});

  const [statusSubmittingId, setStatusSubmittingId] = useState<string | null>(null);
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);
  const [progressSubmittingId, setProgressSubmittingId] = useState<string | null>(null);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});

  const [logbookDialogOpen, setLogbookDialogOpen] = useState(false);
  const [logbookLoading, setLogbookLoading] = useState(false);
  const [logbookTicket, setLogbookTicket] = useState<Ticket | null>(null);
  const [logbookEntries, setLogbookEntries] = useState<TicketLogEntry[]>([]);

  useEffect(() => {
    if (!isTicketsPage || (role !== 'supervisor' && role !== 'department')) {
      setWorkers([]);
      return;
    }
    const loadWorkers = async () => {
      setLoadingWorkers(true);
      const response = await usersService.listWorkers();
      if (response.success && response.data) {
        setWorkers(response.data);
      } else {
        setWorkers([]);
        toast({
          title: 'Worker List Unavailable',
          description: response.error || 'Unable to load registered worker accounts.',
          variant: 'destructive',
        });
      }
      setLoadingWorkers(false);
    };
    void loadWorkers();
  }, [role, isTicketsPage, toast]);

  const filteredTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((ticket) =>
      [
        ticket.title,
        ticket.description,
        ticket.category,
        ticket.location,
        ticket.status,
        ticket.assignedTo,
        ticket.assigneeName,
        ticket.assigneePhone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [tickets, query]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'pending').length;
    const inProgress = tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'verified').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved').length;
    return { total, open, inProgress, resolved };
  }, [tickets]);

  const handleStatusChange = async (ticketId: string, status: 'resolved' | 'open' | 'verified') => {
    setStatusSubmittingId(ticketId);
    try {
      const response = await ticketService.updateStatus(ticketId, { status });
      if (!response.success) {
        toast({
          title: 'Action Failed',
          description: response.error || 'Could not update status.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Status Updated',
        description: status === 'open' ? 'Case reopened.' : status === 'verified' ? 'Case verified.' : 'Case resolved.',
      });
      await refetchTickets();
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const handleAssignWorker = async (ticket: Ticket) => {
    const hasLocalSelection = Object.prototype.hasOwnProperty.call(selectedWorkerByTicket, ticket.id);
    const selectedWorkerIds = hasLocalSelection ? selectedWorkerByTicket[ticket.id] || [] : ticketWorkerIds(ticket);
    const workerIds = selectedWorkerIds.map((value) => value.trim()).filter(Boolean);
    if (workerIds.length === 0) {
      toast({
        title: 'Worker Required',
        description: 'Select one or more registered workers from the dropdown.',
        variant: 'destructive',
      });
      return;
    }

    setAssigningTicketId(ticket.id);
    try {
      const response = await ticketService.assignTicket(ticket.id, { workerIds });
      if (!response.success) {
        toast({
          title: 'Assignment Failed',
          description: response.error || 'Could not assign worker.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Workers Assigned',
        description: 'Supervisor assignment saved.',
      });
      await refetchTickets();
    } finally {
      setAssigningTicketId(null);
    }
  };

  const handleProgressUpdate = async (ticketId: string) => {
    const updateText = (progressDrafts[ticketId] || '').trim();
    if (updateText.length < 5) {
      toast({
        title: 'Update Required',
        description: 'Enter at least 5 characters for progress update.',
        variant: 'destructive',
      });
      return;
    }

    setProgressSubmittingId(ticketId);
    try {
      const response = await ticketService.updateProgress(ticketId, { updateText });
      if (!response.success) {
        toast({
          title: 'Update Failed',
          description: response.error || 'Could not submit progress update.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Progress Updated',
        description: 'Daily progress update saved successfully.',
      });
      setProgressDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      await refetchTickets();
    } finally {
      setProgressSubmittingId(null);
    }
  };

  const openLogbook = async (ticket: Ticket) => {
    setLogbookDialogOpen(true);
    setLogbookLoading(true);
    setLogbookTicket(ticket);
    setLogbookEntries([]);
    const response = await ticketService.getLogbook(ticket.id);
    if (response.success && response.data) {
      setLogbookEntries(response.data);
    } else {
      toast({
        title: 'Logbook Unavailable',
        description: response.error || 'Could not load LogBook.',
        variant: 'destructive',
      });
    }
    setLogbookLoading(false);
  };

  return (
    <>
      <OfficialDashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-heading font-bold text-foreground">{roleDisplay[role]}</h1>
            <p className="text-muted-foreground">{roleDescription[role]}</p>
          </div>

          {ticketsError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {ticketsError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Open</div>
              <div className="text-2xl font-semibold text-info">{stats.open}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">In Progress</div>
              <div className="text-2xl font-semibold text-warning">{stats.inProgress}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Resolved</div>
              <div className="text-2xl font-semibold text-success">{stats.resolved}</div>
            </div>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickets by title, category, status, location"
              className="pl-9"
            />
          </div>

          <div className="space-y-3">
            {ticketsLoading && <div className="text-sm text-muted-foreground">Loading tickets...</div>}
            {!ticketsLoading && filteredTickets.length === 0 && (
              <div className="text-sm text-muted-foreground">No tickets available for this role.</div>
            )}

            {filteredTickets.map((ticket) => {
              const progressDraft = progressDrafts[ticket.id] || '';
              const progressPercent = Number(ticket.progressPercent || 0);
              const assignedWorkerNames = ticketWorkerNames(ticket);
              const hasAssignedWorker = assignedWorkerNames.length > 0;
              const preselectedWorkerIds = hasAssignedWorker ? ticketWorkerIds(ticket) : [];
              const hasLocalSelection = Object.prototype.hasOwnProperty.call(selectedWorkerByTicket, ticket.id);
              const selectedWorkerIds = hasLocalSelection
                ? selectedWorkerByTicket[ticket.id] || []
                : preselectedWorkerIds;
              const selectedWorkerCount = hasLocalSelection ? selectedWorkerIds.length : assignedWorkerNames.length;
              const isReopenedCase = Boolean(
                ticket.reopenedBy?.timestamp ||
                  ticket.reopenedBy?.id ||
                  ticket.reopenedBy?.name ||
                  ticket.reopenWarning
              );
              const canDepartmentManageReopened =
                role === 'department' &&
                isReopenedCase &&
                ticket.status !== 'resolved';
              const isSupervisorLockedTicket =
                (role === 'supervisor' || canDepartmentManageReopened) &&
                (ticket.status === 'verified' || ticket.status === 'resolved');
              const canReopen = role === 'department' && ticket.status === 'resolved';
              const canResolve = role === 'department' && ticket.status !== 'resolved';
              const canSupervisorResolve =
                role === 'supervisor' &&
                ticket.status !== 'resolved' &&
                ticket.status !== 'verified' &&
                !isReopenedCase;
              const canVerify =
                hasAssignedWorker &&
                ticket.status !== 'resolved' &&
                ticket.status !== 'verified' &&
                (role === 'supervisor' || canDepartmentManageReopened);
              const showProgressEditor = isTicketsPage && (role === 'field_inspector' || role === 'worker');
              const showDepartmentActions = isTicketsPage && role === 'department';
              const showSupervisorActions =
                isTicketsPage && (role === 'supervisor' || canDepartmentManageReopened);

              return (
                <div key={ticket.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  {!!ticket.reopenWarning && role !== 'department' && (
                    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                      <div className="font-medium">
                        {(ticket.reopenWarning.departmentName || ticket.reopenWarning.supervisorName || 'Department')}{' '}
                        reopened this case
                      </div>
                      <div>{ticket.reopenWarning.message}</div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{ticket.title}</span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            statusBadge[ticket.status] || 'badge-info'
                          )}
                        >
                          {formatStatus(ticket.status)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ticket.category} | {(ticket.priority || 'medium').toUpperCase()} priority
                      </div>
                      <div className="text-xs text-muted-foreground">{ticket.location || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">
                        Assigned Workers:{' '}
                        {assignedWorkerNames.length > 0 ? assignedWorkerNames.join(', ') : 'Unassigned'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Progress: {progressPercent}% | Updated: {formatDateTime(ticket.progressUpdatedAt)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Ticket ID: {ticket.id}</div>
                  </div>

                  {showDepartmentActions && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openLogbook(ticket)}
                        disabled={statusSubmittingId === ticket.id}
                      >
                        <ClipboardList className="h-4 w-4 mr-1" />
                        LogBook
                      </Button>
                      {canResolve && (
                        <Button
                          onClick={() => void handleStatusChange(ticket.id, 'resolved')}
                          disabled={statusSubmittingId === ticket.id}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                      {canReopen && (
                        <Button
                          variant="outline"
                          onClick={() => void handleStatusChange(ticket.id, 'open')}
                          disabled={statusSubmittingId === ticket.id}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  )}

                  {showSupervisorActions &&
                    (isSupervisorLockedTicket ? (
                      <div className="text-xs text-muted-foreground">
                        Worker assignment is hidden after verification.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Assign Workers</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 w-full justify-between text-left font-normal"
                                disabled={loadingWorkers || assigningTicketId === ticket.id}
                              >
                                <span className="truncate">
                                  {selectedWorkerCount > 0
                                    ? `${selectedWorkerCount} worker(s) selected`
                                    : 'Select workers'}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[320px] max-h-72 overflow-y-auto">
                              <DropdownMenuLabel>Registered Workers</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {workers.length === 0 ? (
                                <div className="px-2 py-2 text-sm text-muted-foreground">No workers available</div>
                              ) : (
                                workers.map((worker) => {
                                  const workerLabel = `${worker.name}${worker.workerSpecialization ? ` - ${worker.workerSpecialization}` : ''}`;
                                  const checked = selectedWorkerIds.includes(worker.id);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={worker.id}
                                      checked={checked}
                                      onSelect={(event) => event.preventDefault()}
                                      onCheckedChange={(nextChecked) => {
                                        setSelectedWorkerByTicket((prev) => {
                                          const current = Object.prototype.hasOwnProperty.call(prev, ticket.id)
                                            ? prev[ticket.id] || []
                                            : preselectedWorkerIds;
                                          const normalized = current.map((value) => value.trim()).filter(Boolean);
                                          let next = normalized;
                                          if (nextChecked) {
                                            if (!normalized.includes(worker.id)) {
                                              next = [...normalized, worker.id];
                                            }
                                          } else {
                                            next = normalized.filter((value) => value !== worker.id);
                                          }
                                          return { ...prev, [ticket.id]: next };
                                        });
                                      }}
                                    >
                                      {workerLabel}
                                    </DropdownMenuCheckboxItem>
                                  );
                                })
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <Button
                            variant="outline"
                            onClick={() => void handleAssignWorker(ticket)}
                            disabled={loadingWorkers || assigningTicketId === ticket.id}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            {hasAssignedWorker ? 'Update Workers' : 'Assign Workers'}
                          </Button>
                          {canSupervisorResolve && (
                            <Button
                              onClick={() => void handleStatusChange(ticket.id, 'resolved')}
                              disabled={statusSubmittingId === ticket.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          )}
                          {canVerify && (
                            <Button
                              onClick={() => void handleStatusChange(ticket.id, 'verified')}
                              disabled={statusSubmittingId === ticket.id}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              {role === 'department' ? 'Verify (Reopened)' : 'Verify'}
                            </Button>
                          )}
                        </div>
                        {role === 'supervisor' && isReopenedCase && ticket.status !== 'resolved' && (
                          <div className="md:col-span-2 text-xs text-muted-foreground">
                            Reopened tickets can only be closed by department.
                          </div>
                        )}
                      </div>
                    ))}

                  {showProgressEditor && (
                    <div className="space-y-2">
                      {role === 'field_inspector' && (
                        <div className="text-xs text-muted-foreground">
                          Daily update deadline: 6:00 PM IST | Last inspector update:{' '}
                          {formatDateTime(ticket.lastInspectorUpdateAt)}
                        </div>
                      )}
                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <Input
                          value={progressDraft}
                          onChange={(event) =>
                            setProgressDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder={
                            role === 'field_inspector'
                              ? 'Enter today field inspection update...'
                              : 'Enter work completion update...'
                          }
                        />
                        <Button
                          onClick={() => void handleProgressUpdate(ticket.id)}
                          disabled={progressSubmittingId === ticket.id}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Submit Update
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </OfficialDashboardLayout>

      <Dialog open={logbookDialogOpen} onOpenChange={setLogbookDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket LogBook</DialogTitle>
            <DialogDescription>
              Official activity LogBook for {logbookTicket?.title || 'ticket'}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
            {logbookLoading && <div className="text-sm text-muted-foreground">Loading logbook...</div>}
            {!logbookLoading && logbookEntries.length === 0 && (
              <div className="text-sm text-muted-foreground">No log entries found.</div>
            )}
            {logbookEntries.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{entry.action}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Actor: {entry.actorName || 'Unknown'} ({entry.actorOfficialRole || 'N/A'})
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{logbookDetailText(entry.details)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfficialDashboard;
