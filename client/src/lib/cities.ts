export type Place = { name: string; lat: number; lng: number };

// Offline quick-picks so search works even if the geocoder is slow.
export const CITIES: Place[] = [
  { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Noida', lat: 28.5355, lng: 77.391 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Agra', lat: 27.1767, lng: 78.0081 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Dehradun', lat: 30.3165, lng: 78.0322 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Mysuru', lat: 12.2958, lng: 76.6394 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
];
export const city = (name: string) => CITIES.find(c => c.name === name)!;
