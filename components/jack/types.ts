export interface ServiceItem {
  id: string;
  number: string;
  name: string;
  description: string;
}

export interface ProjectItem {
  id: string;
  number: string;
  category: string;
  name: string;
  images: {
    col1Top: string;
    col1Bottom: string;
    col2: string;
  };
}
