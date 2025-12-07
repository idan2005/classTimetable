// Cordova Local Notification (for ongoing/live notification)
declare var cordova: any;
// Capacitor Local Notifications
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { TimetableService } from './services/json-parser.service';
import {
  DayOfWeek,
  GroupViewByPeriods,
  ResolvedCell,
} from './models/timetable';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';

const DAY_ORDER: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

@Component({
  selector: 'app-timetable',
  imports: [CommonModule, TableModule],
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimetableComponent implements OnChanges, OnInit, OnDestroy {
  private ongoingNotifInterval: any;
  nextBreakMinutes: number | null = null;
  nextBreakSeconds: number | null = null;
  nextBreakLabel: string | null = null;
  endOfDayHours: number | null = null;
  endOfDayMinutes: number | null = null;
  endOfDaySeconds: number | null = null;
  @Input({ required: true }) groupId!: string;

  view: GroupViewByPeriods | null = null;
  filteredView: GroupViewByPeriods | null = null;

  nowDay: DayOfWeek | null = null;
  nowPeriodId: string | null = null;

  showTodayOnly = false;

  private tickId: any;

  constructor(
    private readonly service: TimetableService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    // Request notification permission
    try {
      await LocalNotifications.requestPermissions();
    } catch (e) {}

    // Schedule notifications for today's breaks
    this.scheduleBreakNotifications();

    // start ticking every 1s to update timers with seconds
    this.tickId = setInterval(() => {
      if (this.view) {
        this.computeNow(this.view);
        this.updateNextBreak();
        this.updateEndOfDayTimer();
        this.cdr.markForCheck();
      }
    }, 1_000);
    // Also update immediately
    setTimeout(() => {
      if (this.view) {
        this.updateNextBreak();
        this.updateEndOfDayTimer();
        this.cdr.markForCheck();
      }
    }, 0);

    // Start ongoing notification updates (every minute)
    this.ongoingNotifInterval = setInterval(() => {
      this.updateOngoingNotification();
    }, 60_000);
    // Also update immediately
    setTimeout(() => this.updateOngoingNotification(), 1000);
  }
  /** Schedule notifications for all breaks today */
  async scheduleBreakNotifications() {
    if (!this.view || !this.nowDay) return;
    const now = new Date();
    const todayRows = this.view.rows;
    // Remove all previous notifications
    try {
      await LocalNotifications.cancel({ notifications: [] });
    } catch (e) {}
    let id = 1;
    for (let i = 0; i < todayRows.length; ++i) {
      const row = todayRows[i];
      const isBreak =
        /^B\d+$/i.test(row.periodId) || /break|הפסקה/i.test(row.title);
      if (isBreak) {
        // Schedule notification for break start
        const [h, m] = row.start.split(":").map(Number);
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
        if (startDate > now) {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: id++,
                title: 'Break started',
                body: `${row.title} started!`,
                schedule: { at: startDate },
              },
            ],
          });
        }
        // Schedule notification for break end (if next period exists)
        const [eh, em] = row.end.split(":").map(Number);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0);
        if (endDate > now) {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: id++,
                title: 'Break ended',
                body: `${row.title} ended!`,
                schedule: { at: endDate },
              },
            ],
          });
        }
      }
    }
  }

  async ngOnChanges(): Promise<void> {
    if (!this.groupId)
      throw new Error('TimetableComponent: groupId input is required');
    this.view = this.service.getGroupViewByPeriods(this.groupId);
    this.computeNow(this.view);
    this.applyFilter();
    this.updateNextBreak();
    await this.scheduleBreakNotifications();
  }
  /** Compute time (in minutes and seconds) until the next break, and label for next break */
  updateNextBreak() {
    if (!this.view || !this.nowDay) {
      this.nextBreakMinutes = null;
      this.nextBreakSeconds = null;
      this.nextBreakLabel = null;
      return;
    }
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const todayRows = this.view.rows;
    let foundCurrent = false;
    let currentIdx = -1;
    // Find the current period index
    for (let i = 0; i < todayRows.length; ++i) {
      const row = todayRows[i];
      const start = this.hhmmToSeconds(row.start);
      const end = this.hhmmToSeconds(row.end);
      if (currentSeconds >= start && currentSeconds < end) {
        foundCurrent = true;
        currentIdx = i;
        break;
      }
    }
    if (!foundCurrent) {
      this.nextBreakMinutes = null;
      this.nextBreakSeconds = null;
      this.nextBreakLabel = null;
      return;
    }

    // Find the next break period after the current period
    let nextBreakStart: number | null = null;
    let nextBreakLabel: string | null = null;
    for (let i = currentIdx + 1; i < todayRows.length; ++i) {
      const row = todayRows[i];
      // Heuristic: break if periodId starts with 'B', or title/name includes 'break' or 'הפסקה', or if all cells for this row have subject 'הפסקה' or classId 'BREAK'
      const isBreak =
        /^B\d+$/i.test(row.periodId) || /break|הפסקה/i.test(row.title);
      if (isBreak) {
        nextBreakStart = this.hhmmToSeconds(row.start);
        nextBreakLabel = row.title;
        break;
      }
    }
    if (nextBreakStart != null) {
      const totalSeconds = nextBreakStart - currentSeconds;
      this.nextBreakMinutes = Math.floor(totalSeconds / 60);
      this.nextBreakSeconds = totalSeconds % 60;
      this.nextBreakLabel = nextBreakLabel;
    } else {
      this.nextBreakMinutes = null;
      this.nextBreakSeconds = null;
      this.nextBreakLabel = null;
    }
  }

  /** Compute time until the end of the school day */
  updateEndOfDayTimer() {
    if (!this.view || !this.nowDay) {
      this.endOfDayHours = null;
      this.endOfDayMinutes = null;
      this.endOfDaySeconds = null;
      return;
    }
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const todayRows = this.view.rows;

    if (todayRows.length === 0) {
      this.endOfDayHours = null;
      this.endOfDayMinutes = null;
      this.endOfDaySeconds = null;
      return;
    }

    // Find the last period of the day
    const lastPeriod = todayRows[todayRows.length - 1];
    const endOfDaySeconds = this.hhmmToSeconds(lastPeriod.end);

    if (currentSeconds >= endOfDaySeconds) {
      // School day has ended
      this.endOfDayHours = null;
      this.endOfDayMinutes = null;
      this.endOfDaySeconds = null;
      return;
    }

    const totalSeconds = endOfDaySeconds - currentSeconds;
    this.endOfDayHours = Math.floor(totalSeconds / 3600);
    this.endOfDayMinutes = Math.floor((totalSeconds % 3600) / 60);
    this.endOfDaySeconds = totalSeconds % 60;
  }

  ngOnDestroy(): void {
    if (this.tickId) clearInterval(this.tickId);
    if (this.ongoingNotifInterval) clearInterval(this.ongoingNotifInterval);
    // Clear ongoing notification
    const win: any = window;
    if (win.cordova && win.cordova.plugins && win.cordova.plugins.notification && win.cordova.plugins.notification.local) {
      win.cordova.plugins.notification.local.clear(9999);
    }
  }

  /** Show/update an ongoing notification with current period/break info */
  updateOngoingNotification() {
  const win: any = window;
  if (!(win.cordova && win.cordova.plugins && win.cordova.plugins.notification && win.cordova.plugins.notification.local)) return;
    if (!this.view || !this.nowDay) return;
    const mins = this.nowMinutes();
    const todayRows = this.view.rows;
    let currentRow = null;
    for (let i = 0; i < todayRows.length; ++i) {
      const row = todayRows[i];
      const start = this.hhmmToMin(row.start);
      const end = this.hhmmToMin(row.end);
      if (mins >= start && mins < end) {
        currentRow = row;
        break;
      }
    }
    if (!currentRow) {
      // Not in any period/break
      cordova.plugins.notification.local.clear(9999);
      return;
    }
    const start = this.hhmmToMin(currentRow.start);
    const end = this.hhmmToMin(currentRow.end);
    const elapsed = mins - start;
    const left = end - mins;
    const isBreak = /^B\d+$/i.test(currentRow.periodId) || /break|הפסקה/i.test(currentRow.title);
    const title = isBreak ? `Break: ${currentRow.title}` : `Period: ${currentRow.title}`;
    const body = isBreak
      ? `Break ongoing. ${elapsed} min passed, ${left} min left.`
      : `Lesson ongoing. ${elapsed} min passed, ${left} min left.`;
    cordova.plugins.notification.local.schedule({
      id: 9999,
      title,
      text: body,
      foreground: true,
      ongoing: true,
      smallIcon: 'res://ic_stat_notify',
      icon: 'res://ic_stat_notify',
      priority: 2,
      channel: 'ongoing',
    });
  }

  toggleTodayOnly() {
    this.showTodayOnly = !this.showTodayOnly;
    this.applyFilter();
  }

  applyFilter() {
    if (!this.view) {
      this.filteredView = null;
      return;
    }
    if (!this.showTodayOnly) {
      this.filteredView = this.view;
      return;
    }
    // Filter to only today
    const today = this.nowDay;
    if (!today || !this.view.dayHeaders.includes(today)) {
      this.filteredView = null;
      return;
    }
    this.filteredView = {
      ...this.view,
      dayHeaders: [today],
      rows: this.view.rows.map((row) => {
        // Ensure all DayOfWeek keys are present, only today has value, others are null
        const allDays: DayOfWeek[] = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ];
        const filteredCells = {} as Record<DayOfWeek, ResolvedCell | null>;
        for (const d of allDays) {
          filteredCells[d] = d === today ? row.cells[today] : null;
        }
        return {
          ...row,
          cells: filteredCells,
        };
      }),
    };
  }

  trackDay = (_: number, d: string) => d;

  textColorFor(bgHex: string): string {
    if (!bgHex) return '#000';
    const hex = bgHex.replace('#', '');
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16),
      g = parseInt(full.slice(2, 4), 16),
      b = parseInt(full.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000' : '#fff';
  }

  /** True if this cell is the current lesson */
  isNowCell(day: DayOfWeek, periodId: string): boolean {
    return this.nowDay === day && this.nowPeriodId === periodId;
  }

  /** True if this header day is "today" */
  isToday(day: DayOfWeek): boolean {
    return this.nowDay === day;
  }

  /** True if this row is the current period row */
  isNowRow(periodId: string): boolean {
    return this.nowPeriodId === periodId;
  }

  private computeNow(v: GroupViewByPeriods): void {
    const jsDay = new Date().getDay(); // 0=Sun .. 6=Sat
    const today: DayOfWeek = DAY_ORDER[jsDay];

    // Only highlight if today is in the rendered headers
    if (!v.dayHeaders.includes(today)) {
      this.nowDay = null;
      this.nowPeriodId = null;
      return;
    }

    const mins = this.nowMinutes();

    // Find the period whose [start,end) contains now
    const hit = v.rows.find((row) => {
      const start = this.hhmmToMin(row.start);
      const end = this.hhmmToMin(row.end);
      return mins >= start && mins < end;
    });

    this.nowDay = today;
    this.nowPeriodId = hit ? hit.periodId : null;
  }

  private nowMinutes(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  private hhmmToMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  private hhmmToSeconds(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 3600 + m * 60;
  }
}
