import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV } from '../csvExport';

describe('exportToCSV utility', () => {
  // Mock DOM APIs
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'mock-url'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {},
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  it('alerts and returns if data is empty', () => {
    exportToCSV([], 'test');
    expect(window.alert).toHaveBeenCalledWith('No data available to export.');
  });

  it('correctly formats CSV rows with simple data', () => {
    const data = [
      { id: 1, name: 'John Doe', city: 'New York' },
      { id: 2, name: 'Jane Smith', city: 'London' }
    ];
    
    // We need to capture the blob content. 
    // A better way is to refactor exportToCSV to return the string, 
    // but for now let's mock Blob to see what's being passed.
    const blobSpy = vi.stubGlobal('Blob', vi.fn().mockImplementation(function(content) {
      return { content };
    }));
    
    exportToCSV(data, 'test');
    
    const expectedHeaders = 'id,name,city';
    const expectedRow1 = '1,John Doe,New York';
    const expectedRow2 = '2,Jane Smith,London';
    
    const blobContent = (Blob as any).mock.calls[0][0][0];
    expect(blobContent).toContain(expectedHeaders);
    expect(blobContent).toContain(expectedRow1);
    expect(blobContent).toContain(expectedRow2);
  });

  it('handles commas and quotes in data', () => {
    const data = [
      { id: 1, title: 'Bible, Study Edition', notes: 'Includes "Special" notes' }
    ];
    
    vi.stubGlobal('Blob', vi.fn().mockImplementation(function(content) {
      return { content };
    }));
    
    exportToCSV(data, 'test');
    
    const blobContent = (Blob as any).mock.calls[0][0][0];
    // Commas should cause wrapping in quotes
    expect(blobContent).toContain('"Bible, Study Edition"');
    // Quotes should be escaped and wrapped
    expect(blobContent).toContain('"Includes ""Special"" notes"');
  });

  it('handles null and undefined values', () => {
    const data = [
      { id: 1, subtitle: null, language: undefined }
    ];
    
    vi.stubGlobal('Blob', vi.fn().mockImplementation(function(content) {
      return { content };
    }));
    
    exportToCSV(data, 'test');
    
    const blobContent = (Blob as any).mock.calls[0][0][0];
    expect(blobContent).toContain('1,,'); // 1 followed by two empty cells
  });
});
