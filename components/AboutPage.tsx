import React from 'react';
import AboutLandingPage from './about-landing/AboutLandingPage';
import type { StoriesSectionProps } from './about-landing/StoriesSection';

interface AboutPageProps extends StoriesSectionProps {
  onBack?: () => void;
  onGoToServices?: () => void;
  onGoToBlog?: () => void;
  onRequestBooking?: () => void;
  aboutData?: any;
  doctors?: any[];
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, posts, categories, onSelectPost }) => {
  return <AboutLandingPage onBackToClinic={onBack} posts={posts} categories={categories} onSelectPost={onSelectPost} />;
};

export default AboutPage;
