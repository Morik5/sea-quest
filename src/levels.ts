export interface Level {
    id: number;
    name: string;
    requiredExperience: number;
  }
  
  export const levels: Level[] = [
    { id: 1, name: 'Beginner', requiredExperience: 0 },
    { id: 2, name: 'Novice', requiredExperience: 100 },
    { id: 3, name: 'Intermediate', requiredExperience: 300 },
    { id: 4, name: 'Advanced', requiredExperience: 600 },
    { id: 5, name: 'Expert', requiredExperience: 1000 },
  ];