
export function makeSerializable(data: any): any {
  
  if (data === null || data === undefined) {
    return data;
  }
  
  
  if (Array.isArray(data)) {
    return data.map(item => makeSerializable(item));
  }
  
  
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  
  if (typeof data === 'object') {
    
    if (data && typeof data.toDate === 'function') {
      try {
        return data.toDate().toISOString();
      } catch (error) {
        console.error("Error converting Timestamp:", error);
        return null;
      }
    }
    
    
    if (data && 'seconds' in data && 'nanoseconds' in data) {
      try {
        return new Date(data.seconds * 1000).toISOString();
      } catch (error) {
        console.error("Error converting serialized Timestamp:", error);
        return null;
      }
    }
    
    
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = makeSerializable(data[key]);
      }
    }
    return result;
  }
  
  
  return data;
}