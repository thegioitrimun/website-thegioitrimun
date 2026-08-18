import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Appointment, Service, Doctor } from '../types';
import { CalendarIcon as PageIcon } from './icons';
import AnimatedSection from './AnimatedSection';
import BackIconButton from './BackIconButton';

interface AppointmentsPageProps {
  appointments: Appointment[];
  services: Service[];
  doctors: Doctor[];
  onBack: () => void;
  onRequestBooking: () => void;
}

const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ appointments, services, doctors, onBack, onRequestBooking }) => {
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
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'pending':
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
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
      <div className="bg-card text-card-foreground p-6 rounded-xl shadow-lg border border-border transition-all-smooth hover:border-primary/50 hover:shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {new Date(appointment.date).toLocaleDateString(getDateLocale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {appointment.time}
            </p>
            <h3 className="text-xl font-bold text-foreground mt-1">{getLocalized(service, 'name') || t('appointments.unknown_service')}</h3>
          </div>
          <span className={`mt-2 sm:mt-0 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full ${getStatusStyles(appointment.status)}`}>
            {getStatusText(appointment.status)}
          </span>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-muted-foreground">{t('booking.doctor_label')}: <span className="font-semibold text-foreground">{doctor?.name || t('common.loading')}</span></p>
          {appointment.notes && <p className="text-sm text-muted-foreground mt-2">{t('booking.notes')}: {appointment.notes}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
      <div className="container mx-auto px-6 py-12">
        <AnimatedSection className="mb-12">
          <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <PageIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('appointments.title')}</h1>
                <p className="text-lg text-muted-foreground mt-1">{t('appointments.subtitle')}</p>
              </div>
            </div>
            <button onClick={onRequestBooking} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-5 rounded-full transition-all-smooth shadow-md hover:shadow-lg transform hover:-translate-y-0.5 btn-press hidden sm:inline-flex">
              {t('appointments.new_booking')}
            </button>
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <h2 className="text-2xl font-bold text-foreground font-heading mb-6">{t('appointments.upcoming')}</h2>
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-6">
              {upcomingAppointments.map((app) => <AppointmentCard key={app.id} appointment={app} />)}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <PageIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-muted-foreground">{t('appointments.no_upcoming')}</h3>
              <button onClick={onRequestBooking} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-5 rounded-full transition-all-smooth shadow-md hover:shadow-lg transform hover:-translate-y-0.5 btn-press">
                {t('appointments.book_now')}
              </button>
            </div>
          )}
        </AnimatedSection>

        <AnimatedSection className="mt-16">
          <h2 className="text-2xl font-bold text-foreground font-heading mb-6">{t('appointments.past')}</h2>
          {pastAppointments.length > 0 ? (
            <div className="space-y-6">
              {pastAppointments.map((app) => <AppointmentCard key={app.id} appointment={app} />)}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <PageIcon className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold text-muted-foreground">{t('appointments.no_past')}</h3>
            </div>
          )}
        </AnimatedSection>
      </div>
    </div>
  );
};

export default AppointmentsPage;
