export interface MenuItem {
  name: string;
  description: string;
  price: string;
  dietary: string;
  variations: string;
}
export interface MenuCategory { name: string; items: MenuItem[] }
export interface MenuDocument { kind: 'menu'; categories: MenuCategory[] }
export interface BusinessCardDocument {
  kind: 'business-card'; name: string; role: string; email: string;
  phone: string; website: string; address: string;
}
export type PrintDocument = MenuDocument | BusinessCardDocument;
export type TemplateId = 'classic-bistro' | 'modernist' | 'retro-diner';
export interface DesignParameters {
  template: TemplateId; businessName: string; subtitle: string;
  palette: 'olive' | 'ink' | 'wine' | 'teal'; typography: 'editorial' | 'sans';
  pageSize: 'letter' | 'a4'; columns: 1 | 2; density: 'airy' | 'balanced' | 'compact';
  ornaments: boolean;
}
export interface RenderResult {
  svgs: string[]; pdf: Uint8Array; output: string; warnings: string[];
  width: number; height: number;
}
export interface PreflightFinding {
  severity: 'error' | 'warning' | 'info'; code: string; message: string;
}
