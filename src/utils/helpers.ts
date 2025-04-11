export function generateRandomCode(length: number): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  const charactersLength = characters.length;
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
}


export function formatDate(dateString: string, includeTime = false): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('cs-CZ', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}


export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}


export function generateId(prefix = ''): string {
  return `${prefix}${Math.random().toString(36).substring(2, 11)}`;
}


export function getInitials(name: string): string {
  if (!name) return '';
  
  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}


export function getTimeRemaining(deadline: string) {
  const total = new Date(deadline).getTime() - new Date().getTime();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  return {
    total,
    days,
    hours,
    minutes,
    seconds,
    isExpired: total < 0,
    isUrgent: total > 0 && days < 3
  };
}
