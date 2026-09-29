import React from 'react';
import AboutLandingPage from './about-landing/AboutLandingPage';
import type { StoriesSectionProps } from './about-landing/StoriesSection';

import type { ServicesSectionProps } from './about-landing/ServicesSection';

interface AboutPageProps extends StoriesSectionProps, ServicesSectionProps {
  onBack?: () => void;
  onGoToServices?: () => void;
  onGoToBlog?: () => void;
  onRequestBooking?: () => void;
  aboutData?: any;
  doctors?: any[];
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, posts, categories, onSelectPost, services, onSelectService }) => {
  return <AboutLandingPage onBackToClinic={onBack} services={services} onSelectService={onSelectService} posts={posts} categories={categories} onSelectPost={onSelectPost} />;
};

export default AboutPage;
