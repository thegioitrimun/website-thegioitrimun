import React, { useEffect, useState } from 'react';
import { LOCAL_SEO_TAGS, normalizeLocalSeoTags, toLocalSeoHashtag } from '../worker/seo/localSeoTags.js';

interface LocalSeoTagsEditorProps {
  value?: string[];
  onChange: (tags: string[]) => void;
}

const LocalSeoTagsEditor: React.FC<LocalSeoTagsEditorProps> = ({ value = [], onChange }) => {
  const normalizedValue = normalizeLocalSeoTags(value);
  const normalizedKey = normalizedValue.join(',');
  const [draft, setDraft] = useState(normalizedValue.join(', '));

  useEffect(() => {
    setDraft(normalizedValue.join(', '));
  }, [normalizedKey]);

  const commitDraft = () => {
    const tags = normalizeLocalSeoTags(draft);
    setDraft(tags.join(', '));
    onChange(tags);
  };

  const toggleTag = (tag: string) => {
    const nextTags = normalizedValue.includes(tag)
      ? normalizedValue.filter((entry) => entry !== tag)
      : normalizeLocalSeoTags([...normalizedValue, tag]);
    setDraft(nextTags.join(', '));
    onChange(nextTags);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Hashtag SEO địa phương</label>
        <input
          data-testid="local-seo-tags-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          className="w-full rounded-md border admin-glass-input p-2"
          placeholder="trị mụn phú quốc, bác sĩ da liễu phú quốc"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Chọn tối đa 5 cụm liên quan trực tiếp. Không gắn toàn bộ từ khóa vào mọi nội dung.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {LOCAL_SEO_TAGS.map((tag) => {
          const selected = normalizedValue.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary'
              }`}
            >
              {toLocalSeoHashtag(tag)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LocalSeoTagsEditor;
