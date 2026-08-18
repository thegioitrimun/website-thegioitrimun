import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Service, Doctor } from '../types';
import { availableTimeSlots } from '../data/booking';
import { CalendarDaysIcon, CheckIcon } from './icons';
import type { Appointment } from '../types';
import * as api from '../services/api';
import BackIconButton from './BackIconButton';

interface BookingPageProps {
    services: Service[];
    doctors: Doctor[];
    initialServiceId?: number;
    onBack: () => void;
    onComplete: (data: Omit<Appointment, 'id' | 'status'>) => void;
}

const BookingPage: React.FC<BookingPageProps> = ({ services, doctors, initialServiceId, onBack, onComplete }) => {
    const { t, i18n } = useTranslation();
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedServiceId, setSelectedServiceId] = useState<number | null>(initialServiceId || null);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

    const steps = [t('booking.step_service'), t('booking.step_doctor'), t('booking.step_time'), t('booking.step_confirm')];

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

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedDoctor = useMemo(() => doctors.find(d => d.id === selectedDoctorId), [doctors, selectedDoctorId]);

    const handleNextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
    const handlePrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const handleSelectService = (id: number) => {
        setSelectedServiceId(id);
        handleNextStep();
    }

    const handleSelectDoctor = (id: string) => {
        setSelectedDoctorId(id);
        handleNextStep();
    }

    const handleSelectTime = (time: string) => {
        setSelectedTime(time);
        handleNextStep();
    }

    const handleSubmit = () => {
        if (!selectedServiceId || !selectedDoctorId || !selectedDate || !selectedTime) {
            alert(t('booking.please_complete'));
            return;
        }
        onComplete({
            service_id: selectedServiceId,
            doctor_id: selectedDoctorId,
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime,
            notes
        });
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return <StepSelectService services={services} onSelect={handleSelectService} t={t} getLocalized={getLocalized} />;
            case 2: return <StepSelectDoctor doctors={doctors} onSelect={handleSelectDoctor} t={t} getLocalized={getLocalized} />;
            case 3: return <StepSelectDateTime selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedTime={selectedTime} onSelectTime={handleSelectTime} t={t} dateLocale={getDateLocale()} />;
            case 4: return <StepConfirm service={selectedService} doctor={selectedDoctor} date={selectedDate} time={selectedTime} notes={notes} setNotes={setNotes} t={t} getLocalized={getLocalized} dateLocale={getDateLocale()} />;
            default: return null;
        }
    }

    return (
        <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
            <div className="container mx-auto px-6 py-12">
                <div className="mb-12">
                    <BackIconButton onClick={onBack} label={t('common.back')} className="mb-4" />
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <CalendarDaysIcon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading">{t('booking.title')}</h1>
                            <p className="text-lg text-muted-foreground mt-1">{t('booking.subtitle')}</p>
                        </div>
                    </div>
                </div>

                {/* Stepper */}
                <div className="mb-12">
                    <ol className="flex items-center w-full">
                        {steps.map((step, index) => {
                            const stepNumber = index + 1;
                            const isCompleted = currentStep > stepNumber;
                            const isCurrent = currentStep === stepNumber;
                            return (
                                <li key={step} className={`flex w-full items-center ${stepNumber < steps.length ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-2 after:inline-block" : ""}`}>
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-colors ${isCompleted ? 'bg-primary text-primary-foreground' : isCurrent ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'}`}>
                                        {isCompleted ? <CheckIcon className="w-5 h-5" /> : <span className="font-bold">{stepNumber}</span>}
                                    </div>
                                    <span className={`absolute mt-20 text-sm font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>{step}</span>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                <div className="bg-card p-8 rounded-xl shadow-lg border border-border min-h-[400px]">
                    {renderStepContent()}
                    <div className="flex justify-between items-center mt-8">
                        <BackIconButton onClick={handlePrevStep} disabled={currentStep === 1} label={t('common.back')} />
                        {currentStep === steps.length && (
                            <button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-6 rounded-full transition-all-smooth btn-press">
                                {t('booking.confirm')}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

// Sub-components for each step
const StepSelectService: React.FC<{ services: Service[], onSelect: (id: number) => void, t: any, getLocalized: any }> = ({ services, onSelect, t, getLocalized }) => (
    <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">{t('booking.select_service')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
                <div key={service.id} onClick={() => onSelect(service.id)} className="bg-muted/50 p-6 rounded-lg cursor-pointer border-2 border-transparent hover:border-primary transition-all-smooth flex items-center gap-4">
                    <div className="w-10 h-10 text-primary flex-shrink-0">{api.getIcon(service.icon, { className: 'w-10 h-10' })}</div>
                    <div>
                        <h3 className="font-bold text-lg text-foreground">{getLocalized(service, 'name')}</h3>
                        <p className="text-sm text-muted-foreground">{getLocalized(service, 'description')}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const StepSelectDoctor: React.FC<{ doctors: Doctor[], onSelect: (id: string) => void, t: any, getLocalized: any }> = ({ doctors, onSelect, t, getLocalized }) => (
    <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">{t('booking.select_doctor')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map(doctor => (
                <div key={doctor.id} onClick={() => onSelect(doctor.id)} className="bg-muted/50 p-6 rounded-lg cursor-pointer border-2 border-transparent hover:border-primary transition-all-smooth text-center">
                    <img src={doctor.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2940&auto=format&fit=crop'} alt={doctor.name} className="w-24 h-24 rounded-full mx-auto object-cover mb-4" />
                    <h3 className="font-bold text-lg text-foreground">{doctor.name}</h3>
                    <p className="text-sm text-primary">{getLocalized(doctor, 'specialization')}</p>
                </div>
            ))}
        </div>
    </div>
);

const StepSelectDateTime: React.FC<{ selectedDate: Date | null, setSelectedDate: (d: Date) => void, selectedTime: string | null, onSelectTime: (t: string) => void, t: any, dateLocale: string }> = ({ selectedDate, setSelectedDate, selectedTime, onSelectTime, t, dateLocale }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyCells = Array.from({ length: firstDayOfMonth });

    const changeMonth = (delta: number) => {
        let newMonth = currentMonth + delta;
        let newYear = currentYear;
        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }
        setCurrentMonth(newMonth);
        setCurrentYear(newYear);
    };

    const dayNames = dateLocale.startsWith('vi')
        ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
        : dateLocale.startsWith('en')
            ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
            : dateLocale.startsWith('ru')
                ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
                : ['日', '一', '二', '三', '四', '五', '六'];

    return (
        <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">{t('booking.select_datetime')}</h2>
            <div className="flex flex-col md:flex-row gap-8">
                {/* Calendar */}
                <div className="md:w-1/2">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-accent btn-press">&lt;</button>
                        <span className="font-bold text-lg">{new Date(currentYear, currentMonth).toLocaleString(dateLocale, { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-accent btn-press">&gt;</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {dayNames.map(day => <div key={day} className="font-semibold text-sm text-muted-foreground">{day}</div>)}
                        {emptyCells.map((_, i) => <div key={`empty-${i}`}></div>)}
                        {calendarDays.map(day => {
                            const date = new Date(currentYear, currentMonth, day);
                            const isPast = date < today;
                            const isSelected = selectedDate?.toDateString() === date.toDateString();
                            return (
                                <button
                                    key={day}
                                    disabled={isPast}
                                    onClick={() => setSelectedDate(date)}
                                    className={`w-10 h-10 rounded-full transition-colors flex items-center justify-center disabled:text-muted-foreground/50 disabled:cursor-not-allowed ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {/* Time Slots */}
                <div className="md:w-1/2">
                    {selectedDate && (
                        <div>
                            <h3 className="font-bold mb-4">{t('booking.available_times')} {selectedDate.toLocaleDateString(dateLocale)}:</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {availableTimeSlots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => onSelectTime(time)}
                                        className={`p-2 rounded-md border text-center transition-colors ${selectedTime === time ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-accent hover:border-primary border-border'}`}
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StepConfirm: React.FC<{ service?: Service, doctor?: Doctor, date: Date | null, time: string | null, notes: string, setNotes: (n: string) => void, t: any, getLocalized: any, dateLocale: string }> = ({ service, doctor, date, time, notes, setNotes, t, getLocalized, dateLocale }) => {
    if (!service || !doctor || !date || !time) return <p>{t('booking.please_complete')}</p>;
    return (
        <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">{t('booking.confirm_info')}</h2>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('booking.service_label')}:</span>
                    <span className="font-semibold text-foreground">{getLocalized(service, 'name')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('booking.doctor_label')}:</span>
                    <span className="font-semibold text-foreground">{doctor.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('booking.date_label')}:</span>
                    <span className="font-semibold text-foreground">{date.toLocaleDateString(dateLocale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('booking.time_label')}:</span>
                    <span className="font-semibold text-foreground">{time}</span>
                </div>
            </div>
            <div className="mt-6">
                <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">{t('booking.notes')}</label>
                <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('booking.notes_placeholder')}
                    className="w-full p-3 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-all-smooth bg-background text-foreground"
                    rows={3}
                ></textarea>
            </div>
        </div>
    );
};


export default BookingPage;
