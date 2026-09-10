import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Appointment, Service, Doctor } from '../types';
import { CalendarIcon as PageIcon, PlusCircleIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import BackIconButton from './BackIconButton';

interface AppointmentsPageProps {
  appointments: Appointment[];
  services: Service[];
  doctors: Doctor[];
  onBack: () => void;
  onRequestBooking: () => void;
}

const AppointmentsPage: React.FC<AppointmentsPageProps> = ({
  appointments,
  services,
  doctors,
  onBack,
  onRequestBooking
}) => {
  const { t, i18n } = useTranslation();

  const getLocalized = (obj: any, field: string): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang !== 'vi') {
      const v = obj[`${field}_${lang}`];
      if (v) return v;
    }
    return obj[field] || '';
  };

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en': return 'en-US';
      case 'ru': return 'ru-RU';
      case 'cn': return 'zh-CN';
      default: return 'vi-VN';
    }
  };

  const getStatusStyles = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
      case 'completed':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/20';
      case 'cancelled':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20';
      case 'pending':
      default:
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
    }
  };

  const getStatusText = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed': return t('appointments.status_confirmed');
      case 'completed': return t('appointments.status_completed');
      case 'cancelled': return t('appointments.status_cancelled');
      case 'pending': return t('appointments.status_pending');
    }
  };

  const now = new Date();
  const upcomingAppointments = appointments
    .filter(a => new Date(`${a.date}T${a.time}`) >= now && a.status !== 'completed' && a.status !== 'cancelled')
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const pastAppointments = appointments
    .filter(a => new Date(`${a.date}T${a.time}`) < now || a.status === 'completed' || a.status === 'cancelled')
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const AppointmentCard: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
    const service = services.find(s => s.id === appointment.service_id);
    const doctor = doctors.find(d => d.id === appointment.doctor_id);

    return (
      <div className="rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_20px_50px_-30px_rgba(24,35,32,0.4)] backdrop-blur-2xl dark:border-white/10 p-3.5 sm:p-5 mx-1 sm:mx-0 transition-all hover:border-primary/40 space-y-3">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl bg-background/50 border border-white/40 dark:border-white/5 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <PageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              {new Date(appointment.date).toLocaleDateString(getDateLocale(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} — <strong className="text-foreground font-mono">{appointment.time}</strong>
            </span>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md ${getStatusStyles(appointment.status)}`}>
            {getStatusText(appointment.status)}
          </span>
        </div>

        {/* Content */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            {getLocalized(service, 'name') || t('appointments.unknown_service')}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {t('booking.doctor_label')}: <strong className="text-foreground">{doctor?.name || t('common.loading')}</strong>
          </p>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="rounded-xl border border-white/40 bg-background/30 backdrop-blur-md p-2.5 text-xs text-muted-foreground dark:border-white/5">
            <span className="font-semibold text-foreground">{t('booking.notes')}:</span> {appointment.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Top Header Card */}
        <AnimatedSection>
          <div className="rounded-2xl sm:rounded-[1.75rem] border border-white/70 bg-card/85 p-3.5 sm:p-5 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 mx-1 sm:mx-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <BackIconButton onClick={onBack} label={t('common.back')} />
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <PageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-heading tracking-tight">{t('appointments.title')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{t('appointments.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={onRequestBooking}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-0 bg-primary hover:bg-primary/90 text-primary-foreground backdrop-blur-xl px-4 py-2 text-xs sm:text-sm font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 btn-press"
            >
              <PlusCircleIcon className="w-4 h-4" />
              <span>{t('appointments.new_booking')}</span>
            </button>
          </div>
        </AnimatedSection>

        {/* Upcoming Section */}
        <AnimatedSection>
          <div className="flex items-center gap-2 mb-3 px-1 sm:px-0">
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-muted-foreground">{t('appointments.upcoming')}</h2>
            {upcomingAppointments.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                {upcomingAppointments.length}
              </span>
            )}
          </div>
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {upcomingAppointments.map((app) => <AppointmentCard key={app.id} appointment={app} />)}
            </div>
          ) : (
            <div className="text-center py-10 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 mx-1 sm:mx-0">
              <PageIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <h3 className="text-sm font-semibold text-muted-foreground">{t('appointments.no_upcoming')}</h3>
              <button
                onClick={onRequestBooking}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-0 bg-primary/10 hover:bg-primary/20 text-primary backdrop-blur-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all btn-press"
              >
                {t('appointments.book_now')}
              </button>
            </div>
          )}
        </AnimatedSection>

        {/* Past Section */}
        <AnimatedSection className="mt-8">
          <div className="flex items-center gap-2 mb-3 px-1 sm:px-0">
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-muted-foreground">{t('appointments.past')}</h2>
            {pastAppointments.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.2 rounded-full bg-muted text-muted-foreground">
                {pastAppointments.length}
              </span>
            )}
          </div>
          {pastAppointments.length > 0 ? (
            <div className="space-y-3">
              {pastAppointments.map((app) => <AppointmentCard key={app.id} appointment={app} />)}
            </div>
          ) : (
            <div className="text-center py-8 rounded-2xl sm:rounded-[1.7rem] border border-white/70 bg-card/85 shadow-[0_28px_70px_-48px_rgba(24,35,32,0.55)] backdrop-blur-2xl dark:border-white/10 p-6 mx-1 sm:mx-0">
              <PageIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <h3 className="text-sm font-semibold text-muted-foreground">{t('appointments.no_past')}</h3>
            </div>
          )}
        </AnimatedSection>
      </div>
    </div>
  );
};

export default AppointmentsPage;
