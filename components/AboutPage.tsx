import React from 'react';
import { useTranslation } from 'react-i18next';
import AnimatedSection from './AnimatedSection';
import type { AboutPageData, Doctor, AboutFeature, AboutValue, AboutContent } from '../types';
import * as api from '../services/api';
import BackIconButton from './BackIconButton';

interface AboutPageProps {
    onBack: () => void;
    onGoToServices: () => void;
    aboutData: AboutPageData;
    doctors: Doctor[];
}

// Helper to get localized field from DB data with fallback to default (Vietnamese)
function getLocalized<T extends Record<string, any>>(item: T, field: string, lang: string): string {
    if (lang === 'vi') return item[field] || '';
    const localizedKey = `${field}_${lang}`;
    return item[localizedKey] || item[field] || '';
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack, onGoToServices, aboutData, doctors }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language;

    const content = aboutData.content;

    return (
        <div className="bg-background text-foreground transition-colors duration-300 animate-scale-in">
            <div className="container mx-auto px-6 py-12">
                <div className="mb-12">
                </div>

                {/* Hero Section */}
                <section className="relative rounded-xl overflow-hidden mb-12 md:mb-20 bg-muted/50 px-8 py-4 md:px-16 md:py-8">
                    <div className="absolute inset-0 w-full h-full bg-cover bg-center opacity-10 dark:opacity-5" style={{ backgroundImage: `url('${content.image_url}')` }}></div>
                    <AnimatedSection className="relative z-10 text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground font-heading mb-6">{getLocalized(content, 'header_title', lang)}</h1>
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{getLocalized(content, 'header_subtitle', lang)}</p>
                    </AnimatedSection>
                </section>

                {/* Mission & Vision Section */}
                <section className="py-8 md:py-12">
                    <AnimatedSection className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground font-heading">{getLocalized(content, 'mission_title', lang)}</h2>
                    </AnimatedSection>
                    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 text-center md:text-left">
                        <AnimatedSection>
                            <h3 className="text-2xl font-bold text-primary mb-4">{t('about.mission')}</h3>
                            <p className="text-muted-foreground leading-relaxed text-lg">{getLocalized(content, 'mission_text', lang)}</p>
                        </AnimatedSection>
                        <AnimatedSection stagger={100}>
                            <h3 className="text-2xl font-bold text-primary mb-4">{t('about.vision')}</h3>
                            <p className="text-muted-foreground leading-relaxed text-lg">{getLocalized(content, 'vision_text', lang)}</p>
                        </AnimatedSection>
                    </div>
                </section>

                {/* Reasons to Choose Us Section */}
                <section className="py-20">
                    <AnimatedSection className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground font-heading">{t('about.why_choose_title')}</h2>
                        <p className="text-lg text-muted-foreground mt-2">{t('about.why_choose_subtitle')}</p>
                    </AnimatedSection>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {aboutData.reasonsToChoose.map((reason, index) => (
                            <AnimatedSection key={reason.id} stagger={index * 100}>
                                <div className="bg-card text-card-foreground p-8 rounded-xl shadow-lg h-full text-center border border-transparent hover:border-primary/30 hover:shadow-xl transition-all-smooth">
                                    <div className="w-12 h-12 mx-auto text-primary mb-5">{api.getIcon(reason.icon, { className: "w-12 h-12" })}</div>
                                    <h3 className="text-xl font-bold mb-3 font-heading">{getLocalized(reason, 'title', lang)}</h3>
                                    <p className="text-muted-foreground">{getLocalized(reason, 'description', lang)}</p>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </section>

                {/* Doctors Section */}
                <section className="py-20 bg-muted/50 rounded-xl">
                    <div className="container mx-auto px-6">
                        <AnimatedSection className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-foreground font-heading">{t('about.team_title')}</h2>
                            <p className="text-lg text-muted-foreground mt-2">{t('about.team_subtitle')}</p>
                        </AnimatedSection>
                        <div className="flex flex-wrap justify-center gap-8 max-w-6xl mx-auto">
                            {doctors.map((doctor, index) => (
                                <AnimatedSection key={doctor.id} className="h-full w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1.5rem)] max-w-sm" stagger={index * 100}>
                                    <div className="bg-card text-card-foreground rounded-xl shadow-lg overflow-hidden h-full flex flex-col transform transition-all-smooth hover:-translate-y-2 hover:shadow-2xl">
                                        <img src={doctor.avatar_url || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2940&auto=format&fit=crop'} alt={doctor.name} className="w-full h-64 object-cover object-top" />
                                        <div className="p-6 flex flex-col flex-grow text-center">
                                            <h3 className="text-xl font-bold text-primary">{doctor.name}</h3>
                                            <p className="font-semibold text-muted-foreground mb-3">{doctor.specialization}</p>
                                            <p className="text-foreground/80">{doctor.description}</p>
                                        </div>
                                    </div>
                                </AnimatedSection>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Core Values Section */}
                <section className="py-20">
                    <AnimatedSection className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground font-heading">{getLocalized(content, 'values_title', lang)}</h2>
                        <p className="text-lg text-muted-foreground mt-2">{getLocalized(content, 'values_subtitle', lang)}</p>
                    </AnimatedSection>
                    <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                        {aboutData.coreValues.map((value, index) => (
                            <AnimatedSection key={value.id} stagger={index * 100}>
                                <div className="flex flex-col items-center p-4 text-center">
                                    <div className="bg-primary/10 p-5 rounded-full mb-4">
                                        <div className="w-10 h-10 text-primary">{api.getIcon(value.icon, { className: "w-10 h-10" })}</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">{getLocalized(value, 'title', lang)}</h3>
                                    <p className="text-sm text-muted-foreground">{getLocalized(value, 'description', lang)}</p>
                                </div>
                            </AnimatedSection>
                        ))}
                    </div>
                </section>

                {/* CTA Section */}
                <section className="text-center py-12">
                    <AnimatedSection>
                        <h2 className="text-3xl font-bold text-foreground font-heading mb-4">{t('about.cta_title')}</h2>
                        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{t('about.cta_subtitle')}</p>
                        <button onClick={onGoToServices} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-8 rounded-full transition-all-smooth text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 btn-press">
                            {t('about.cta_button')}
                        </button>
                    </AnimatedSection>
                </section>
            </div>
        </div>
    );
};

export default AboutPage;
