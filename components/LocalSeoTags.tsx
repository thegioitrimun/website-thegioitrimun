import React from 'react';
import { normalizeLocalSeoTags, toLocalSeoHashtag } from '../worker/seo/localSeoTags.js';

interface LocalSeoTagsProps {
  tags?: string[];
  language: string;
}

const LocalSeoTags: React.FC<LocalSeoTagsProps> = ({ tags = [], language }) => {
  const visibleTags = language.startsWith('vi') ? normalizeLocalSeoTags(tags) : [];
  if (visibleTags.length === 0) return null;

  return (
    <section data-testid="local-seo-tags" className="rounded-[24px] border border-border bg-card p-5 md:p-6">
      <p className="section-kicker">Từ khóa liên quan tại Phú Quốc</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"
          >
            {toLocalSeoHashtag(tag)}
          </span>
        ))}
      </div>
    </section>
  );
};

export default LocalSeoTags;
