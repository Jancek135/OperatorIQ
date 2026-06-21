// =============================================================
// Database types — generated from Supabase schema
// =============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: { id: string; name: string; slug: string | null; logo_url: string | null; primary_color: string | null; plan: string; created_at: string }
        Insert: { id?: string; name: string; slug?: string | null; logo_url?: string | null; primary_color?: string | null; plan?: string }
        Update: { id?: string; name?: string; slug?: string | null; logo_url?: string | null; primary_color?: string | null; plan?: string }
      }
      profiles: {
        Row: { id: string; account_id: string; full_name: string | null; role: string; created_at: string }
        Insert: { id: string; account_id: string; full_name?: string | null; role?: string; created_at?: string }
        Update: { id?: string; account_id?: string; full_name?: string | null; role?: string; created_at?: string }
      }
      locations: {
        Row: { id: string; account_id: string; name: string; adresse: string | null; plz: string | null; ort: string | null; ansprechpartner: string | null; telefon: string | null; miete: number; notizen: string | null; created_at: string }
        Insert: { id?: string; account_id: string; name: string; adresse?: string | null; plz?: string | null; ort?: string | null; ansprechpartner?: string | null; telefon?: string | null; miete?: number; notizen?: string | null }
        Update: { id?: string; account_id?: string; name?: string; adresse?: string | null; plz?: string | null; ort?: string | null; ansprechpartner?: string | null; telefon?: string | null; miete?: number; notizen?: string | null }
      }
      machines: {
        Row: { id: string; account_id: string; location_id: string | null; name: string; standort: string; miete: number; baseline_rev: number; baseline_tx: number; sort_order: number; created_at: string }
        Insert: { id?: string; account_id: string; location_id?: string | null; name: string; standort?: string; miete?: number; baseline_rev?: number; baseline_tx?: number; sort_order?: number }
        Update: { id?: string; account_id?: string; location_id?: string | null; name?: string; standort?: string; miete?: number; baseline_rev?: number; baseline_tx?: number; sort_order?: number }
      }
      machine_costs: {
        Row: { id: string; machine_id: string; fix_cost: number; updated_at: string }
        Insert: { id?: string; machine_id: string; fix_cost?: number }
        Update: { id?: string; machine_id?: string; fix_cost?: number }
      }
      rev_overrides: {
        Row: { id: string; account_id: string; machine_id: string; rev: number; tx: number; imported_at: string }
        Insert: { id?: string; account_id: string; machine_id: string; rev: number; tx: number }
        Update: { id?: string; account_id?: string; machine_id?: string; rev?: number; tx?: number }
      }
      snapshots: {
        Row: { id: string; account_id: string; machine_id: string; month_label: string; rev: number; tx: number; created_at: string }
        Insert: { id?: string; account_id: string; machine_id: string; month_label: string; rev: number; tx: number }
        Update: { id?: string; account_id?: string; machine_id?: string; month_label?: string; rev?: number; tx?: number }
      }
      fleet_settings: {
        Row: { id: string; account_id: string; we_rate: number; total_fix: number; variable_costs: number; updated_at: string }
        Insert: { id?: string; account_id: string; we_rate?: number; total_fix?: number; variable_costs?: number }
        Update: { id?: string; account_id?: string; we_rate?: number; total_fix?: number; variable_costs?: number }
      }
      we_overrides: {
        Row: { id: string; machine_id: string; we_rate: number; updated_at: string }
        Insert: { id?: string; machine_id: string; we_rate: number }
        Update: { id?: string; machine_id?: string; we_rate?: number }
      }
      suppliers: {
        Row: { id: string; account_id: string; name: string; kontakt: string | null; telefon: string | null; email: string | null; notizen: string | null; created_at: string }
        Insert: { id?: string; account_id: string; name: string; kontakt?: string | null; telefon?: string | null; email?: string | null; notizen?: string | null }
        Update: { id?: string; account_id?: string; name?: string; kontakt?: string | null; telefon?: string | null; email?: string | null; notizen?: string | null }
      }
      catalog_products: {
        Row: { id: string; account_id: string; supplier_id: string | null; name: string; barcode: string | null; kategorie: string | null; emoji: string | null; image_url: string | null; ek: number; vk: number; mwst_satz: number; mindestbestand: number; einheit: string; sort_order: number; aktiv: boolean; created_at: string }
        Insert: { id?: string; account_id: string; supplier_id?: string | null; name: string; barcode?: string | null; kategorie?: string | null; emoji?: string | null; image_url?: string | null; ek: number; vk: number; mwst_satz?: number; mindestbestand?: number; einheit?: string; sort_order?: number; aktiv?: boolean }
        Update: { id?: string; account_id?: string; supplier_id?: string | null; name?: string; barcode?: string | null; kategorie?: string | null; emoji?: string | null; image_url?: string | null; ek?: number; vk?: number; mwst_satz?: number; mindestbestand?: number; einheit?: string; sort_order?: number; aktiv?: boolean }
      }
    }
  }
}

// =============================================================
// App-level types (enriched, joined)
// =============================================================

export interface Location {
  id: string
  account_id: string
  name: string
  adresse?: string | null
  plz?: string | null
  ort?: string | null
  ansprechpartner?: string | null
  telefon?: string | null
  miete: number
  nebenkosten?: number
  vertrag_bis?: string | null  // ISO date string YYYY-MM-DD
  notizen?: string | null
}

export interface Supplier {
  id: string
  account_id: string
  name: string
  kontakt?: string | null
  telefon?: string | null
  email?: string | null
  notizen?: string | null
}

export interface StockLevel {
  id: string
  account_id: string
  product_id: string
  current_qty: number
  target_qty: number
  avg_monthly_consumption: number
  updated_at: string
}

export interface CatalogProduct {
  id: string
  account_id: string
  supplier_id?: string | null
  name: string
  barcode?: string | null
  kategorie?: string | null
  emoji?: string | null
  image_url?: string | null
  ek: number
  vk: number
  mwst_satz: number
  mindestbestand: number
  einheit: string
  sort_order: number
  aktiv: boolean
  // Joined
  supplier?: Supplier
}

export interface Machine {
  id: string
  account_id: string
  location_id?: string | null
  name: string
  standort: string   // populated from locations.name in server pages; falls back to machines.standort text
  miete: number
  baseline_rev: number
  baseline_tx: number
  sort_order: number
  // Joined
  fix_cost?: number
  we_rate_override?: number
  rev_override?: number
  tx_override?: number
  location?: Location // full location object when needed
}

export interface Snapshot {
  machine_id: string
  month_label: string
  rev: number
  tx: number
}

export interface FleetSettings {
  we_rate: number
  total_fix: number
  variable_costs: number
}

export interface FleetData {
  machines: Machine[]
  snapshots: Snapshot[]
  settings: FleetSettings
  accountName: string
}

// CSV import
export interface CSVRow {
  csvName: string
  rev: number
  tx: number
  matchedMachineId: string | null
  matchedMachineName: string | null
  score: number
}

export type MachineStatus = 'g' | 'y' | 'r'

export interface Insight {
  icon: string
  text: string
  type: 'positive' | 'warning' | 'neutral'
}

export interface Alert {
  icon: string
  text: string
  machine: string
  severity: 'r' | 'y'
}
