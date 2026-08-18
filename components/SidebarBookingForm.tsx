import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Service, Doctor, Appointment } from '../types';
import { availableTimeSlots } from '../data/booking';
import * as api from '../services/api';
import BackIconButton from './BackIconButton';

interface SidebarBookingFormProps {
    services: Service[];
    doctors: Doctor[];
    onComplete: (data: Omit<Appointment, 'id' | 'status'>) => void;
}

const SidebarBookingForm: React.FC<SidebarBookingFormProps> = ({ services, doctors, onComplete }) => {
    const { t, i18n } = useTranslation();
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

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

    const handleNextStep = () => setCurrentStep(prev => prev + 1);
    const handlePrevStep = () => setCurrentStep(prev => prev - 1);

    const handleSelectService = (id: number) => {
        setSelectedServiceId(id);
        handleNextStep();
    }
    const handleSelectDoctor = (id: string) => {
        setSelectedDoctorId(id);
        handleNextStep();
    }
    const handleSelectDateTime = (time: string) => {
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
            case 1:
                return (
                    <div>
                        <h3 className="font-bold text-foreground mb-4">{t('booking.step_service')} (1/4)</h3>
                        <div className="space-y-2">
                            {services.map(service => (
                                <button key={service.id} onClick={() => handleSelectService(service.id)} className="w-full text-left bg-muted/50 p-3 rounded-lg cursor-pointer border-2 border-transparent hover:border-primary transition-all-smooth flex items-center gap-4">
                                    <div className="w-8 h-8 text-primary flex-shrink-0">{api.getIcon(service.icon, { className: 'w-8 h-8' })}</div>
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground">{getLocalized(service, 'name')}</h4>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div>
                        <h3 className="font-bold text-foreground mb-4">{t('booking.step_doctor')} (2/4)</h3>
                        <div className="space-y-2">
                            {doctors.map(doctor => (
                                <button key={doctor.id} onClick={() => handleSelectDoctor(doctor.id)} className="w-full text-left bg-muted/50 p-3 rounded-lg cursor-pointer border-2 border-transparent hover:border-primary transition-all-smooth flex items-center gap-4">
                                    <img src={doctor.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2940&auto=format&fit=crop'} alt={doctor.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground">{doctor.name}</h4>
                                        <p className="text-xs text-primary">{getLocalized(doctor, 'specialization')}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div>
                        <h3 className="font-bold text-foreground mb-4">{t('booking.step_time')} (3/4)</h3>
                        <input
                            type="date"
                            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full p-2 border border-input rounded-md bg-background mb-4"
                        />
                        {selectedDate && (
                            <div className="grid grid-cols-3 gap-2">
                                {availableTimeSlots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => handleSelectDateTime(time)}
                                        className={`p-2 rounded-md border text-center transition-colors ${selectedTime === time ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 hover:bg-accent hover:border-primary border-border'}`}
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 4:
                if (!selectedService || !selectedDoctor || !selectedDate || !selectedTime) return <p>{t('booking.please_complete')}</p>;
                return (
                    <div>
                        <h3 className="font-bold text-foreground mb-4">{t('booking.step_confirm')} (4/4)</h3>
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">{t('booking.service_label')}:</span><span className="font-semibold text-right">{getLocalized(selectedService, 'name')}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t('booking.doctor_label')}:</span><span className="font-semibold text-right">{selectedDoctor.name}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t('booking.date_label')}:</span><span className="font-semibold text-right">{selectedDate.toLocaleDateString(getDateLocale())}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t('booking.time_label')}:</span><span className="font-semibold text-right">{selectedTime}</span></div>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('booking.notes_placeholder')}
                            className="mt-4 w-full p-2 text-sm border border-input rounded-md bg-background"
                            rows={2}
                        ></textarea>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="flex flex-col h-full animate-scale-in">
            <div className="flex-grow overflow-y-auto -mx-4 px-4 pb-4">
                {renderStepContent()}
            </div>
            <div className="flex-shrink-0 pt-4 border-t border-border -mx-4 px-4">
                <div className="flex justify-between items-center">
                    <BackIconButton onClick={handlePrevStep} disabled={currentStep === 1} label={t('common.back')} className="h-10 w-10" />
                    {currentStep < 4 && (
                        <button onClick={handleNextStep} disabled={!selectedServiceId || (currentStep === 2 && !selectedDoctorId) || (currentStep === 3 && !selectedTime)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-5 rounded-full transition-all-smooth text-sm disabled:opacity-50 disabled:cursor-not-allowed btn-press">
                            {t('booking.next')}
                        </button>
                    )}
                    {currentStep === 4 && (
                        <button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-5 rounded-full transition-all-smooth text-sm btn-press">
                            {t('booking.confirm')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SidebarBookingForm;
