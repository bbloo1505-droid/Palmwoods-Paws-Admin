export type ServiceType =
  | "dog_walk"
  | "pet_visit"
  | "pet_feeding"
  | "pet_minding"
  | "other";

export type BookingStatus = "scheduled" | "cancelled" | "completed";
export type VisitStatus = "in_progress" | "completed" | "cancelled";
export type InvoiceStatus = "owed" | "paid" | "void";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  suburb: string | null;
  notes: string | null;
  emergency_contact: string | null;
  preferred_payment: string | null;
  created_at: string;
  updated_at: string;
};

export type HouseInfo = {
  client_id: string;
  key_location: string | null;
  alarm_notes: string | null;
  bin_day: string | null;
  gate_notes: string | null;
  wifi: string | null;
  garage_code: string | null;
  extras: string | null;
  updated_at: string;
};

export type Pet = {
  id: string;
  owner_id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  birthday: string | null;
  microchip: string | null;
  vet_name: string | null;
  vaccinated_until: string | null;
  weight_kg: number | null;
  favourite_treats: string | null;
  behaviour: string | null;
  commands: string | null;
  medication: string | null;
  feeding: string | null;
  house_access: string | null;
  lead_location: string | null;
  preferred_route: string | null;
  known_dogs: string | null;
  can_off_leash: boolean;
  swims: boolean;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  owner_id: string;
  client_id: string;
  pet_id: string;
  starts_at: string;
  service_type: ServiceType;
  recurrence_rule: string | null;
  series_id: string | null;
  status: BookingStatus;
  notes: string | null;
  amount: number | null;
  created_at: string;
};

export type Visit = {
  id: string;
  owner_id: string;
  booking_id: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  status: VisitStatus;
  created_at: string;
};

export type VisitChecklistItem = {
  id: string;
  visit_id: string;
  label: string;
  done: boolean;
  sort_order: number;
};

export type VisitPhoto = {
  id: string;
  visit_id: string;
  storage_path: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  owner_id: string;
  client_id: string;
  visit_id: string | null;
  amount: number;
  status: InvoiceStatus;
  due_on: string | null;
  paid_on: string | null;
  notes: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  owner_id: string;
  pet_id: string | null;
  client_id: string | null;
  title: string;
  due_on: string;
  kind: string;
  done: boolean;
  created_at: string;
};

export type BookingWithRelations = Booking & {
  client: Pick<Client, "id" | "name" | "suburb" | "address"> | null;
  pet: Pick<Pet, "id" | "name" | "photo_url" | "species"> | null;
  visit: Pick<Visit, "id" | "status" | "started_at" | "finished_at"> | null;
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  dog_walk: "Dog Walk",
  pet_visit: "Pet Visit",
  pet_feeding: "Feeding & Cuddles",
  pet_minding: "Pet Minding",
  other: "Other",
};

export const DEFAULT_CHECKLIST = [
  "Water",
  "Feed",
  "Medication",
  "Toilet",
  "Walk",
  "Lock house",
] as const;

export type WalkStatus = "in_progress" | "completed" | "cancelled";
export type PawMood = "chill" | "happy" | "crazy" | "energetic";
export type PawReportStatus = "draft" | "sent";

export type Walk = {
  id: string;
  owner_id: string;
  pet_id: string;
  client_id: string;
  booking_id: string | null;
  visit_id: string | null;
  started_at: string;
  finished_at: string | null;
  distance_m: number;
  duration_sec: number;
  suburb: string | null;
  status: WalkStatus;
  created_at: string;
};

export type WalkTrackPoint = {
  id: string;
  walk_id: string;
  recorded_at: string;
  lat: number;
  lng: number;
  accuracy: number | null;
};

export type PawReport = {
  id: string;
  walk_id: string;
  owner_id: string;
  pet_id: string;
  client_id: string;
  public_token: string;
  mood: PawMood | string | null;
  toilet_poo: boolean;
  toilet_wee: boolean;
  voice_note_raw: string | null;
  report_body: string | null;
  suburb: string | null;
  distance_m: number;
  duration_sec: number;
  show_full_route: boolean;
  status: PawReportStatus;
  sent_at: string | null;
  created_at: string;
};

export type PawReportMedia = {
  id: string;
  report_id: string;
  kind: "photo" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
};

export type PublicPawReport = {
  id: string;
  public_token: string;
  mood: string | null;
  toilet_poo: boolean;
  toilet_wee: boolean;
  report_body: string | null;
  suburb: string | null;
  distance_m: number;
  duration_sec: number;
  show_full_route: boolean;
  sent_at: string | null;
  created_at: string;
  pet_name: string;
  pet_species: string;
  pet_photo_url: string | null;
  client_name: string;
};

export const MOOD_OPTIONS: { value: PawMood; label: string; emoji: string }[] = [
  { value: "chill", label: "Chill", emoji: "😴" },
  { value: "happy", label: "Happy", emoji: "🙂" },
  { value: "crazy", label: "Crazy", emoji: "🤪" },
  { value: "energetic", label: "Full of energy", emoji: "⚡" },
];

export type EnquiryStatus = "new" | "contacted" | "converted" | "closed";

export type WebsiteEnquiry = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  suburb: string | null;
  service_needed: string | null;
  pet_type: string | null;
  preferred_dates: string | null;
  pet_details: string | null;
  message: string;
  meet_greet: boolean;
  source: string;
  status: EnquiryStatus;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

