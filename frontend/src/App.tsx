import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, Search, UploadCloud, Eye, EyeOff, Trash2, CheckCircle2, 
  Clock, AlertCircle, Download, FileSpreadsheet, History, LogOut, 
  DollarSign, Building2, UserCheck, Users, FolderPlus,
  Edit3, Save, X, Copy, Check, FileDown, Layers, File as FileIcon,
  Filter, RotateCcw, Tag, MapPin, Bell, RefreshCw, GitCommit, Upload,
  BarChart3, PieChart, Printer, CheckSquare, Square, Code, Sparkles,
  Camera, SwitchCamera, ScanLine, Sun, Moon, Maximize2, Lock, ShieldCheck
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

const getSafePreviewUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const backendOrigin = API_BASE.replace(/\/api$/, '');
  return url
    .replace('http://localhost:8000', backendOrigin)
    .replace('http://127.0.0.1:8000', backendOrigin);
};

const getCategoryPrefix = (catName: string) => {
  const n = (catName || '').toLowerCase();
  if (n.includes('ใบเสร็จ') || n.includes('ใบกำกับ') || n.includes('tax') || n.includes('receipt') || n.includes('inv')) {
    return 'INV-';
  }
  if (n.includes('สัญญา') || n.includes('contract')) {
    return 'CNT-';
  }
  if (n.includes('สั่งซื้อ') || n.includes('po') || n.includes('purchase')) {
    return 'PO-';
  }
  if (n.includes('ราชการ') || n.includes('ทางการ') || n.includes('gov')) {
    return 'GOV-';
  }
  return 'DOC-';
};

const isExcelOrSpreadsheet = (filename: string = '', mimeType: string = '') => {
  const name = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv')
  );
};

// คอมโพเนนต์แสดงผลตาราง Excel บนหน้าเว็บ
function ExcelSheetViewer({ fileUrl, fileBlob }: { fileUrl?: string; fileBlob?: Blob | null }) {
  const [sheets, setSheets] = useState<{ [sheetName: string]: any[][] }>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadWorkbook = async () => {
      try {
        let arrayBuffer: ArrayBuffer;
        if (fileBlob) {
          arrayBuffer = await fileBlob.arrayBuffer();
        } else if (fileUrl) {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error('ไม่สามารถดาวน์โหลดไฟล์ตารางเพื่อแสดงผลได้');
          arrayBuffer = await res.arrayBuffer();
        } else {
          return;
        }

        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        if (!isMounted) return;

        const parsedSheets: { [key: string]: any[][] } = {};
        wb.SheetNames.forEach((name) => {
          const sheet = wb.Sheets[name];
          parsedSheets[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        });

        setSheets(parsedSheets);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'เกิดข้อผิดพลาดในการอ่านข้อมูลตาราง');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadWorkbook();
    return () => { isMounted = false; };
  }, [fileUrl, fileBlob]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 p-6">
        <Clock className="w-6 h-6 animate-spin text-cyan-500" />
        <span className="text-xs">กำลังเรนเดอร์เนื้อหาตารางสเปรดชีต...</span>
      </div>
    );
  }

  if (error || sheetNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
        <p className="text-xs">{error || 'ไม่พบข้อมูลในชีต'}</p>
      </div>
    );
  }

  const rows = sheets[activeSheet] || [];

  return (
    <div className="flex flex-col h-full bg-[#070b14] text-slate-200 overflow-hidden select-text">
      {sheetNames.length > 1 && (
        <div className="flex gap-1 overflow-x-auto p-1.5 bg-[#0c1322] border-b border-slate-800 shrink-0 text-xs">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className={`px-3 py-1 rounded text-[11px] font-medium transition shrink-0 ${
                activeSheet === name
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-2">
        <table className="min-w-full border-collapse border border-slate-800 text-[11px] font-mono">
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-850/50">
                <td className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-500 text-center select-none w-8 text-[10px]">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1 border border-slate-800/80 whitespace-nowrap text-slate-300">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  department_id?: number;
  department_name?: string;
}

interface DocItem {
  id: string;
  title: string;
  document_code: string;
  document_date: string;
  status: string;
  file_name: string;
  current_version?: number;
  view_count?: number;
  is_public?: boolean;
  uploader_username?: string;
  category_name: string;
  department_name: string;
  branch_name: string;
  tags?: string;
  snippet?: string;
}

interface StructuredData {
  organization?: string | null;
  tax_id?: string | null;
  document_number?: string | null;
  document_date?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  grand_total?: number | null;
  summary?: string | null;
}

interface DocDetail {
  id: string;
  title: string;
  document_code: string;
  document_date: string;
  status: string;
  current_version?: number;
  view_count?: number;
  is_public?: boolean;
  allowed_department_ids?: number[];
  allowed_user_ids?: number[];
  file_name: string;
  category_name: string;
  department_name: string;
  branch_name: string;
  tags?: string;
  mime_type: string;
  extracted_text: string;
  download_url: string;
  smart_meta: {
    tax_id: string | null;
    total_amount: number | null;
    organization: string | null;
  };
  structured_data?: StructuredData;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('dms_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthData = params.get('oauth_success');
    if (oauthData) {
      try {
        const userObj = JSON.parse(decodeURIComponent(oauthData));
        sessionStorage.setItem('dms_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error('Failed to parse OAuth session', err);
      }
    }
  }, []);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('dms_theme');
    return (savedTheme as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dms_theme', newTheme);
  };

  const isDark = theme === 'dark';

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [stats, setStats] = useState({
    total_documents: 0,
    completed_documents: 0,
    total_amount_extracted: 0,
    top_category: 'ทั่วไป',
    department_breakdown: [] as { name: string; count: number }[],
    category_breakdown: [] as { name: string; count: number }[]
  });

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const [isBulk, setIsBulk] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCode, setUploadCode] = useState(`DOC-${Math.floor(1000 + Math.random() * 9000)}`);
  const [bulkCodePrefix, setBulkCodePrefix] = useState('DOC-');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadCatId, setUploadCatId] = useState(1);
  const [uploadDeptId, setUploadDeptId] = useState(1);
  const [uploadBranchId, setUploadBranchId] = useState(1);
  const [uploadTags, setUploadTags] = useState('');

  const [uploadIsPublic, setUploadIsPublic] = useState(true);
  const [uploadAllowedDepts, setUploadAllowedDepts] = useState<number[]>([]);
  const [uploadAllowedUsers, setUploadAllowedUsers] = useState<number[]>([]);

  const [selectedSingleFile, setSelectedSingleFile] = useState<globalThis.File | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<globalThis.File[]>([]);
  
  const [previewModalFile, setPreviewModalFile] = useState<{ name: string; size: number; url: string; rawFile?: globalThis.File } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [showCameraModal, setShowCameraModal] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const newVersionInputRef = useRef<HTMLInputElement>(null);

  const [activeDoc, setActiveDoc] = useState<DocDetail | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'ocr' | 'json'>('ocr');
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [retryingOcr, setRetryingOcr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showVersionTab, setShowVersionTab] = useState(false);

  const [showPrintSlip, setShowPrintSlip] = useState(false);

  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('USER');
  const [newUserDeptId, setNewUserDeptId] = useState<number>(1);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editDeptId, setEditDeptId] = useState<number>(1);
  const [editPassword, setEditPassword] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');

  // ซิงค์แผนกของ user คนปัจจุบันเข้ากับช่องอัปโหลดทันทีเมื่อล็อกอิน
  useEffect(() => {
    if (currentUser?.department_id && currentUser.role !== 'ADMIN') {
      setUploadDeptId(currentUser.department_id);
      setUploadAllowedDepts([currentUser.department_id]);
    }
  }, [currentUser]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
      const interval = setInterval(() => {
        fetchDocs();
        fetchStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentUser, selectedCat, selectedDept, selectedBranch, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showCameraModal) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      }).then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      }).catch((err) => {
        alert('ไม่สามารถเข้าถึงกล้องได้: ' + err.message);
        setShowCameraModal(false);
      });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [showCameraModal, facingMode]);

  const loadInitialData = async () => {
    fetchStats();
    fetchOptions();
    fetchUsersQuick();
    fetchDocs();
  };

  const fetchUsersQuick = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'เข้าสู่ระบบไม่สำเร็จ');
      
      sessionStorage.setItem('dms_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      if (data.user.department_id && data.user.role !== 'ADMIN') {
        setUploadDeptId(data.user.department_id);
        setUploadAllowedDepts([data.user.department_id]);
      }
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dms_user');
    localStorage.removeItem('dms_user');
    setCurrentUser(null);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/meta/options`);
      const data = await res.json();
      setCategories(data.categories || []);
      setDepartments(data.departments || []);
      setBranches(data.branches || []);
      if (data.categories?.length > 0) {
        const firstCat = data.categories[0];
        setUploadCatId(firstCat.id);
        const initPrefix = getCategoryPrefix(firstCat.name);
        setUploadCode(`${initPrefix}${Math.floor(1000 + Math.random() * 9000)}`);
        setBulkCodePrefix(initPrefix);
      }
      if (data.departments?.length > 0) {
        const initialDept = (currentUser?.role !== 'ADMIN' && currentUser?.department_id)
          ? currentUser.department_id
          : data.departments[0].id;
        setUploadDeptId(initialDept);
        setNewUserDeptId(data.departments[0].id);
      }
      if (data.branches?.length > 0) setUploadBranchId(data.branches[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocs = async (queryOverride?: string) => {
    try {
      const activeQuery = queryOverride !== undefined ? queryOverride : searchQueryRef.current;
      let url = `${API_BASE}/documents/search?current_username=${encodeURIComponent(currentUser?.username || 'admin')}&`;
      if (activeQuery) url += `q=${encodeURIComponent(activeQuery)}&`;
      if (selectedCat) url += `category_id=${selectedCat}&`;
      if (selectedDept) url += `department_id=${selectedDept}&`;
      if (selectedBranch) url += `branch_id=${selectedBranch}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;

      const res = await fetch(url);
      const data = await res.json();
      setDocs(data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchInputChange = async (val: string) => {
    setSearchQuery(val);
    searchQueryRef.current = val;
    if (val.trim().length > 0) {
      try {
        const res = await fetch(`${API_BASE}/documents/suggestions?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      fetchDocs('');
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    searchQueryRef.current = suggestion;
    setShowSuggestions(false);
    fetchDocs(suggestion);
  };

  const resetFilters = () => {
    setSearchQuery('');
    searchQueryRef.current = '';
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedCat(null);
    setSelectedDept(null);
    setSelectedBranch(null);
    setStartDate('');
    setEndDate('');
    fetchDocs('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (isBulk) {
        const filesArray = Array.from(e.dataTransfer.files);
        setBulkFiles((prev) => [...prev, ...filesArray]);
      } else {
        const file = e.dataTransfer.files[0];
        setSelectedSingleFile(file);
        setPreviewBlobUrl(URL.createObjectURL(file));
        if (!uploadTitle) {
          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  };

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedSingleFile(file);
    if (file) {
      setPreviewBlobUrl(URL.createObjectURL(file));
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } else {
      setPreviewBlobUrl(null);
    }
  };

  const clearSingleFile = () => {
    setSelectedSingleFile(null);
    setPreviewBlobUrl(null);
    setShowFullPreviewModal(false);
    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = '';
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setBulkFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0 && bulkFileInputRef.current) {
        bulkFileInputRef.current.value = '';
      }
      return updated;
    });
  };

  const clearAllBulkFiles = () => {
    setBulkFiles([]);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleOpenBulkPreview = (file: globalThis.File) => {
    const url = URL.createObjectURL(file);
    setPreviewModalFile({
      name: file.name,
      size: file.size,
      url: url,
      rawFile: file
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new (window as any).File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
          if (isBulk) {
            setBulkFiles((prev) => [...prev, file]);
          } else {
            setSelectedSingleFile(file);
            setPreviewBlobUrl(URL.createObjectURL(file));
            if (!uploadTitle) setUploadTitle(`เอกสารสแกนกล้อง ${new Date().toLocaleTimeString('th-TH')}`);
          }
          setShowCameraModal(false);
          showToast('บันทึกภาพถ่ายเอกสารเรียบร้อยแล้ว');
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const toggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.length === docs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(docs.map((d) => d.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    if (!confirm(`คุณต้องการลบเอกสารที่เลือกทั้งหมด ${selectedDocIds.length} รายการใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`${API_BASE}/documents/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: selectedDocIds,
          username: currentUser?.username || 'admin'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'ลบไม่สำเร็จ');
      
      setSelectedDocIds([]);
      showToast(data.message);
      fetchDocs();
      fetchStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportSelected = () => {
    const selectedList = docs.filter((d) => selectedDocIds.includes(d.id));
    if (selectedList.length === 0) return;

    const headers = ['ID', 'Document Code', 'Title', 'Date', 'Category', 'Department', 'Branch', 'Tags', 'Status'];
    const rows = selectedList.map((d) => [
      d.id,
      d.document_code,
      `"${d.title.replace(/"/g, '""')}"`,
      d.document_date,
      d.category_name,
      d.department_name,
      d.branch_name,
      `"${(d.tags || '').replace(/"/g, '""')}"`,
      d.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dms_selected_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Export เรียบร้อย ${selectedList.length} รายการ`);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const effectiveDeptId = (currentUser?.role !== 'ADMIN' && currentUser?.department_id) 
        ? currentUser.department_id 
        : uploadDeptId;

      if (isBulk) {
        if (bulkFiles.length === 0) {
          alert('กรุณาเลือกหรือสแกนไฟล์อย่างน้อย 1 ไฟล์');
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append('category_id', uploadCatId.toString());
        formData.append('department_id', effectiveDeptId.toString());
        formData.append('branch_id', uploadBranchId.toString());
        formData.append('tags', uploadTags);
        formData.append('code_prefix', bulkCodePrefix);
        formData.append('document_date', uploadDate);
        formData.append('is_public', uploadIsPublic ? 'true' : 'false');
        formData.append('allowed_departments', uploadAllowedDepts.join(','));
        formData.append('allowed_users', uploadAllowedUsers.join(','));
        formData.append('username', currentUser?.username || 'admin');
        bulkFiles.forEach((f) => {
          formData.append('files', f);
        });

        const res = await fetch(`${API_BASE}/documents/bulk-upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'เกิดข้อผิดพลาดในการ Bulk Upload');
        
        clearAllBulkFiles();
        showToast(data.message || `อัปโหลดสำเร็จ ${bulkFiles.length} รายการ`);
      } else {
        if (!selectedSingleFile) {
          alert('กรุณาเลือกไฟล์เอกสาร หรือถ่ายภาพจากกล้อง');
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append('title', uploadTitle);
        formData.append('document_code', uploadCode);
        formData.append('document_date', uploadDate);
        formData.append('category_id', uploadCatId.toString());
        formData.append('department_id', effectiveDeptId.toString());
        formData.append('branch_id', uploadBranchId.toString());
        formData.append('tags', uploadTags);
        formData.append('is_public', uploadIsPublic ? 'true' : 'false');
        formData.append('allowed_departments', uploadAllowedDepts.join(','));
        formData.append('allowed_users', uploadAllowedUsers.join(','));
        formData.append('username', currentUser?.username || 'admin');
        formData.append('file', selectedSingleFile);

        const res = await fetch(`${API_BASE}/documents/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'เกิดข้อผิดพลาดในการอัปโหลด');
        
        setUploadTitle('');
        setUploadTags('');
        setUploadIsPublic(true);
        setUploadAllowedDepts(currentUser?.department_id ? [currentUser.department_id] : []);
        setUploadAllowedUsers([]);
        clearSingleFile();
        
        const currentCat = categories.find((c) => c.id === uploadCatId);
        const prefix = currentCat ? getCategoryPrefix(currentCat.name) : 'DOC-';
        setUploadCode(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
        showToast('อัปโหลดเอกสารเรียบร้อย กำลังวิเคราะห์ OCR...');
      }

      fetchDocs();
      fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openInspector = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${id}?username=${encodeURIComponent(currentUser?.username || 'system')}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'ไม่สามารถโหลดข้อมูลเอกสารได้');

      setActiveDoc(data);
      setInspectorTab('ocr');
      setEditTitle(data.title);
      setEditText(data.extracted_text || '');
      setEditTags(data.tags || '');
      setCopied(false);
      setShowVersionTab(false);

      fetchDocs();
      fetch(`${API_BASE}/documents/${id}/versions`)
        .then(r => r.json())
        .then(vData => setVersionHistory(vData.versions || []));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDoc) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', currentUser?.username || 'admin');

    try {
      const res = await fetch(`${API_BASE}/documents/${activeDoc.id}/new-version`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'อัปโหลดเวอร์ชันใหม่ไม่สำเร็จ');
      
      showToast(data.message);
      openInspector(activeDoc.id);
      fetchDocs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      if (newVersionInputRef.current) newVersionInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!activeDoc) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${activeDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          extracted_text: editText,
          tags: editTags,
          username: currentUser?.username || 'admin'
        })
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      
      setActiveDoc({ ...activeDoc, title: editTitle, extracted_text: editText, tags: editTags });
      fetchDocs();
      showToast('บันทึกการแก้ไขเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetryOcr = async () => {
    if (!activeDoc) return;
    setRetryingOcr(true);
    try {
      const res = await fetch(`${API_BASE}/documents/${activeDoc.id}/retry-ocr?username=${currentUser?.username}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'ไม่สามารถสั่ง Retry OCR ได้');
      
      setEditText(data.extracted_text || '');
      setActiveDoc((prev) => prev ? {
        ...prev,
        status: 'COMPLETED',
        extracted_text: data.extracted_text || '',
        smart_meta: data.smart_meta || prev.smart_meta,
        structured_data: data.structured_data || prev.structured_data
      } : null);

      fetchDocs();
      fetchStats();
      showToast('วิเคราะห์ OCR ใหม่เรียบร้อยแล้ว!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetryingOcr(false);
    }
  };

  const handleCopyText = () => {
    const textToCopy = inspectorTab === 'ocr' 
      ? editText 
      : JSON.stringify(activeDoc?.structured_data || {}, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!activeDoc) return;
    const element = document.createElement("a");
    const file = new Blob([editText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeDoc.document_code}_extracted.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบเอกสารฉบับนี้ออกจากระบบใช่หรือไม่?')) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${id}?username=${currentUser?.username}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('ลบเอกสารไม่สำเร็จ');
      
      setActiveDoc(null);
      fetchDocs();
      fetchStats();
      showToast('ลบเอกสารออกจากระบบแล้ว');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openLogsModal = async () => {
    setShowLogs(true);
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openUserManagement = async () => {
    setShowUserModal(true);
    fetchUsersQuick();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          full_name: newFullName,
          role: newRole,
          department_id: newUserDeptId
        })
      });
      if (!res.ok) throw new Error('ไม่สามารถสร้างผู้ใช้ได้ (Username ซ้ำ)');
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      fetchUsersQuick();
      showToast('เพิ่มผู้ใช้งานใหม่เรียบร้อย');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`${API_BASE}/users/${editingUser.id}?current_username=${currentUser?.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editFullName,
          role: editRole,
          department_id: editDeptId,
          password: editPassword || undefined
        })
      });
      if (!res.ok) throw new Error('บันทึกการแก้ไขไม่สำเร็จ');
      setEditingUser(null);
      setEditPassword('');
      fetchUsersQuick();
      showToast('แก้ไขข้อมูลผู้ใช้เรียบร้อย');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEditUser = (u: any) => {
    setEditingUser(u);
    setEditFullName(u.full_name);
    setEditRole(u.role);
    setEditDeptId(u.department_id || (departments[0]?.id || 1));
    setEditPassword('');
  };

  const handleDeleteUser = async (userId: number, targetUsername: string) => {
    if (targetUsername === 'admin') {
      alert('ไม่สามารถลบบัญชี Admin หลักของระบบได้');
      return;
    }
    if (targetUsername === currentUser?.username) {
      alert('คุณไม่สามารถลบบัญชีตัวเองที่กำลังล็อกอินอยู่ได้');
      return;
    }
    if (!confirm(`คุณต้องการลบผู้ใช้งาน "${targetUsername}" ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}?current_username=${currentUser?.username}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'ลบผู้ใช้ไม่สำเร็จ');
      
      showToast(data.message);
      fetchUsersQuick();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      });
      setNewCategoryName('');
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName })
      });
      setNewDeptName('');
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm('ต้องการลบแผนกนี้หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/departments/${id}`, { method: 'DELETE' });
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await fetch(`${API_BASE}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBranchName })
      });
      setNewBranchName('');
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBranch = async (id: number) => {
    if (!confirm('ต้องการลบสาขานี้หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/branches/${id}`, { method: 'DELETE' });
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-300 ${isDark ? 'bg-[#070b14]' : 'bg-slate-100'}`}>
        <div className={`w-full max-w-md border rounded-2xl p-8 shadow-2xl backdrop-blur-xl transition-colors duration-300 ${isDark ? 'bg-[#0f172a] border-cyan-500/20' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col items-center mb-6">
            <div className={`p-3 bg-white rounded-2xl mb-3 shadow-xl flex items-center justify-center w-28 h-16 border ${isDark ? 'border-transparent shadow-cyan-500/10' : 'border-slate-200 shadow-slate-200'}`}>
              <img src="/jib-logo.png" alt="J-Document Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <h1 className={`text-2xl font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>J-Document DMS</h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ระบบจัดการเอกสารดิจิทัล</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div>
              <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้งาน..."
                autoComplete="off"
                className={`w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                required
              />
            </div>
            <div>
              <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="กรอกรหัสผ่าน..."
                  autoComplete="new-password"
                  className={`w-full border rounded-lg pl-4 pr-11 py-2.5 text-sm outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-500 transition focus:outline-none`}
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 rotate-180" /> เข้าสู่ระบบ
            </button>
          </form>

          {/* เส้นคั่นตัวเลือก Single Sign-On */}
          <div className="relative my-6 text-center">
            <div className={`absolute inset-0 flex items-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="w-full border-t border-slate-700/60"></div>
            </div>
            <span className={`relative px-3 text-[11px] uppercase tracking-wider ${isDark ? 'bg-[#0f172a] text-slate-500' : 'bg-white text-slate-400'}`}>
              หรือเข้าสู่ระบบด้วย
            </span>
          </div>

          {/* ปุ่มล็อกอินด้วย GitHub */}
          <div className="space-y-2.5">
            <a
              href="http://localhost:8000/api/auth/github"
              className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-3 text-xs font-semibold transition shadow-sm ${
                isDark 
                  ? 'bg-[#171e2e] hover:bg-[#1e273b] border-slate-700 text-slate-200' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              <span>เข้าสู่ระบบด้วย GitHub</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans pb-12 transition-colors duration-300 ${isDark ? 'bg-[#070b14] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-bounce border ${isDark ? 'bg-cyan-950 border-cyan-500/40 text-white' : 'bg-white border-cyan-400 text-slate-800'}`}>
          <Bell className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className={`border-b sticky top-0 z-30 px-6 py-3 flex items-center justify-between backdrop-blur-md transition-colors duration-300 ${isDark ? 'border-slate-800 bg-[#0c1322]/80' : 'border-slate-200 bg-white/85 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded-lg shadow-sm flex items-center justify-center w-12 h-9 border border-slate-200">
            <img src="/jib-logo.png" alt="J-Document Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div>
            <h1 className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>J-Document DMS</h1>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ระบบจัดการเอกสารดิจิทัล</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
            title={isDark ? 'เปลี่ยนเป็นธีมสว่าง (Light Mode)' : 'เปลี่ยนเป็นธีมมืด (Dark Mode)'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <div className={`px-3 py-1 border rounded-full flex items-center gap-2 text-xs ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
            <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentUser.full_name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${currentUser.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-500 border border-cyan-500/30' : 'bg-slate-200 text-slate-600'}`}>
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={() => setShowAnalyticsModal(true)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-cyan-600'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Analytics Chart
          </button>

          <a
            href={`${API_BASE}/documents/export`}
            target="_blank"
            rel="noreferrer"
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Export CSV
          </a>

          {currentUser.role === 'ADMIN' && (
            <>
              <button
                onClick={openUserManagement}
                className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Users
              </button>

              <button
                onClick={() => setShowCategoryModal(true)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-500" /> Master Data
              </button>

              <button
                onClick={openLogsModal}
                className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
              >
                <History className="w-3.5 h-3.5 text-cyan-500" /> Audit Logs
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-medium text-rose-500 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> ออก
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`border rounded-xl p-4 shadow-sm flex items-center gap-4 transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-slate-100'}`}>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>เอกสารทั้งหมด</p>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.total_documents} <span className="text-xs font-normal text-slate-400">ฉบับ</span></h3>
            </div>
          </div>

          <div className={`border rounded-xl p-4 shadow-sm flex items-center gap-4 transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-slate-100'}`}>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>OCR เสร็จสิ้น</p>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.completed_documents} <span className="text-xs font-normal text-slate-400">ฉบับ</span></h3>
            </div>
          </div>

          <div className={`border rounded-xl p-4 shadow-sm flex items-center gap-4 transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-slate-100'}`}>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ยอดเงินรวมในระบบ</p>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.total_amount_extracted.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>

          <div className={`border rounded-xl p-4 shadow-sm flex items-center gap-4 transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-slate-100'}`}>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-500">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>หมวดหมู่ยอดนิยม</p>
              <h3 className={`text-base font-bold truncate max-w-[150px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.top_category}</h3>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Left Form */}
          <div className={`lg:col-span-4 border rounded-2xl p-5 shadow-sm h-fit transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800 shadow-xl' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-cyan-500" />
                <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isBulk ? 'อัปโหลดหลายไฟล์ (Bulk)' : 'อัปโหลดเอกสารใหม่'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsBulk(!isBulk);
                  clearSingleFile();
                  clearAllBulkFiles();
                }}
                className={`px-2.5 py-1 border rounded-lg text-[10px] font-semibold flex items-center gap-1 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-cyan-500/30' : 'bg-slate-100 hover:bg-slate-200 text-cyan-600 border-slate-300'}`}
              >
                <Layers className="w-3 h-3" /> {isBulk ? 'สลับเป็นรายไฟล์' : 'สลับเป็น Bulk Upload'}
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-3.5">
              {!isBulk ? (
                <>
                  <div>
                    <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ชื่อเอกสาร *</label>
                    <input
                      type="text"
                      placeholder="เช่น ใบเสร็จจัดซื้ออุปกรณ์ IT, งบการเงิน Excel"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>รหัสเอกสาร</label>
                      <input
                        type="text"
                        value={uploadCode}
                        onChange={(e) => setUploadCode(e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition font-mono ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                        required
                      />
                    </div>
                    <div>
                      <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>วันที่</label>
                      <input
                        type="date"
                        value={uploadDate}
                        onChange={(e) => setUploadDate(e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      คำนำหน้ารหัสชุด (Prefix)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น HW-, INV-"
                      value={bulkCodePrefix}
                      onChange={(e) => setBulkCodePrefix(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition font-mono ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                      required
                    />
                    <span className="text-[9px] text-cyan-500 mt-1 block">
                      จะรันเป็น: {bulkCodePrefix.trim() || 'DOC-'}001, 002...
                    </span>
                  </div>
                  <div>
                    <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>วันที่เอกสารทั้งชุด</label>
                    <input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>หมวดหมู่</label>
                  <select
                    value={uploadCatId}
                    onChange={(e) => {
                      const newId = Number(e.target.value);
                      setUploadCatId(newId);
                      const selected = categories.find((c) => c.id === newId);
                      if (selected) {
                        const prefix = getCategoryPrefix(selected.name);
                        setUploadCode(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
                        setBulkCodePrefix(prefix);
                      }
                    }}
                    className={`w-full border rounded-lg px-2 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    แผนกหลัก {currentUser?.role !== 'ADMIN' && <span className="text-amber-500 font-semibold">(เฉพาะแผนกคุณ)</span>}
                  </label>
                  <select
                    value={uploadDeptId}
                    disabled={currentUser?.role !== 'ADMIN'}
                    onChange={(e) => setUploadDeptId(Number(e.target.value))}
                    className={`w-full border rounded-lg px-2 py-2 text-xs outline-none transition ${
                      currentUser?.role !== 'ADMIN'
                        ? 'opacity-70 cursor-not-allowed bg-slate-800/50'
                        : ''
                    } ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>สาขา</label>
                  <select
                    value={uploadBranchId}
                    onChange={(e) => setUploadBranchId(Number(e.target.value))}
                    className={`w-full border rounded-lg px-2 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>แท็กกำกับเอกสาร (คั่นด้วยจุลภาค เช่น #ด่วน, #ใบเสร็จ)</label>
                <input
                  type="text"
                  placeholder="#ด่วน, #งบประมาณ2569"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                />
              </div>

              {/* สิทธิ์การเข้าถึงเอกสาร (Access Control) */}
              <div className={`p-3.5 border rounded-xl space-y-3 ${isDark ? 'bg-[#0c1322] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                    <Lock className="w-3.5 h-3.5" /> สิทธิ์การเข้าถึงเอกสาร (Access Control)
                  </label>
                </div>
                
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="perm" 
                      checked={uploadIsPublic} 
                      onChange={() => setUploadIsPublic(true)} 
                    />
                    <span>ทุกคนเข้าถึงได้ (Public)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      name="perm" 
                      checked={!uploadIsPublic} 
                      onChange={() => {
                        setUploadIsPublic(false);
                        if (currentUser?.department_id) {
                          setUploadAllowedDepts([currentUser.department_id]);
                        }
                      }} 
                    />
                    <span>จำกัดสิทธิ์ (Restricted)</span>
                  </label>
                </div>

                {!uploadIsPublic && (
                  <div className="pt-2.5 border-t border-slate-700/50 space-y-3">
                    <div>
                      <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1 mb-1.5">
                        <Building2 className="w-3.5 h-3.5" /> แผนกที่อนุญาตให้เข้าดู:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {departments.map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={uploadAllowedDepts.includes(d.id)}
                              onChange={(e) => {
                                if (e.target.checked) setUploadAllowedDepts(prev => [...prev, d.id]);
                                else setUploadAllowedDepts(prev => prev.filter(id => id !== d.id));
                              }}
                            />
                            <span className="truncate">{d.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[11px] font-semibold text-cyan-500 flex items-center gap-1 mb-1.5">
                        <Users className="w-3.5 h-3.5" /> หรืออนุญาตเฉพาะรายบุคคล:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {usersList.filter(u => u.username !== currentUser?.username).map(u => (
                          <label key={u.id} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={uploadAllowedUsers.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) setUploadAllowedUsers(prev => [...prev, u.id]);
                                else setUploadAllowedUsers(prev => prev.filter(id => id !== u.id));
                              }}
                            />
                            <span className="truncate">{u.full_name} <span className="text-slate-500 text-[9px]">({u.department_name || 'ไม่ระบุ'})</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`text-[11px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isBulk ? 'แนบไฟล์เอกสารหลายรายการ (Bulk)' : 'แนบไฟล์เอกสาร (PDF, รูปภาพ หรือ Excel/CSV)'}
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => {
                    if (isBulk && bulkFileInputRef.current) bulkFileInputRef.current.click();
                    if (!isBulk && singleFileInputRef.current) singleFileInputRef.current.click();
                  }}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : isDark
                        ? 'border-slate-700 hover:border-cyan-500/50 bg-[#141e33]/50 hover:bg-[#141e33]'
                        : 'border-slate-300 hover:border-cyan-500 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>ลากไฟล์มาวางที่นี่</p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>หรือคลิกเพื่อเลือกไฟล์จากเครื่อง</p>
                  </div>
                  <span className={`text-[9px] px-2.5 py-0.5 border rounded-full font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>
                    PDF, JPG, PNG, XLSX, XLS, CSV — สูงสุด 50 MB/ไฟล์
                  </span>
                </div>

                <input
                  ref={singleFileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.xlsx,.xls,.csv"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />

                <input
                  ref={bulkFileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.xlsx,.xls,.csv"
                  onChange={handleBulkFileChange}
                  className="hidden"
                />
              </div>

              <div className={`p-3 border rounded-xl flex items-center justify-between ${isDark ? 'bg-[#111c30] border-cyan-500/20' : 'bg-cyan-50/50 border-cyan-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/10 text-cyan-500 rounded-lg">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>ถ่ายภาพ / สแกนเอกสาร</h4>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>เปิดกล้องเพื่อถ่ายภาพเอกสารสด</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${isDark ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40' : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-600'}`}
                >
                  <Camera className="w-3.5 h-3.5" /> เปิดกล้อง
                </button>
              </div>

              {!isBulk && selectedSingleFile && (
                <div className="space-y-2">
                  <div className={`p-2.5 border rounded-xl flex items-center justify-between ${isDark ? 'bg-slate-900/80 border-cyan-500/30' : 'bg-slate-100 border-slate-200'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      {isExcelOrSpreadsheet(selectedSingleFile.name, selectedSingleFile.type) ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-cyan-500 shrink-0" />
                      )}
                      <div className="overflow-hidden">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSingleFile.name}</p>
                        <p className="text-[10px] text-slate-500">{formatFileSize(selectedSingleFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowFullPreviewModal(true)}
                        className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-50'}`}
                        title="ขยายดูตัวอย่างเต็มจอ"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">ขยายดู</span>
                      </button>

                      <button
                        type="button"
                        onClick={clearSingleFile}
                        className="p-1 text-slate-400 hover:text-rose-500 transition"
                        title="ยกเลิกไฟล์นี้"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="relative group h-64 border border-slate-700/50 rounded-xl overflow-hidden bg-black/40">
                    {isExcelOrSpreadsheet(selectedSingleFile.name, selectedSingleFile.type) ? (
                      <ExcelSheetViewer fileBlob={selectedSingleFile} />
                    ) : (
                      previewBlobUrl && (
                        <>
                          <iframe src={previewBlobUrl} className="w-full h-full border-0" title="Pre-upload preview" />
                          <div 
                            onClick={() => setShowFullPreviewModal(true)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                          >
                            <span className="px-3 py-1.5 bg-cyan-600/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                              <Eye className="w-4 h-4" /> คลิกเพื่อดูขนาดใหญ่
                            </span>
                          </div>
                        </>
                      )
                    )}
                  </div>
                </div>
              )}

              {isBulk && bulkFiles.length > 0 && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  <div className="text-[11px] font-semibold text-cyan-500 flex items-center justify-between">
                    <span>รายการไฟล์ที่เตรียมอัปโหลด ({bulkFiles.length} รายการ):</span>
                    <button
                      type="button"
                      onClick={clearAllBulkFiles}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                  {bulkFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className={`p-2 border rounded-lg flex items-center justify-between transition ${isDark ? 'bg-slate-900/80 border-slate-700/80 hover:border-cyan-500/30' : 'bg-slate-50 border-slate-200 hover:border-cyan-500'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                        {isExcelOrSpreadsheet(file.name, file.type) ? (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <FileIcon className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        )}
                        <div className="overflow-hidden">
                          <p className={`text-[11px] truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{file.name}</p>
                          <p className="text-[9px] text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenBulkPreview(file)}
                          className={`p-1.5 rounded-md border text-xs transition flex items-center gap-1 ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20' : 'bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-50'}`}
                          title="พรีวิวดูไฟล์นี้"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-semibold">ดูไฟล์</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeBulkFile(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md transition"
                          title="ลบไฟล์นี้ออกจากคิว"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" /> กำลังนำเข้าและประมวลผล OCR...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" /> {isBulk ? `เริ่มอัปโหลดทั้งหมด (${bulkFiles.length} ไฟล์)` : 'อัปโหลดและเริ่มวิเคราะห์'}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Table & Search Right Section */}
          <div className={`lg:col-span-8 border rounded-2xl p-5 shadow-sm space-y-4 transition-colors ${isDark ? 'bg-[#0f172a] border-slate-800 shadow-xl' : 'bg-white border-slate-200'}`}>
            <div className="flex gap-2 relative" ref={searchContainerRef}>
              <div className="relative flex-1">
                <Search className={`w-4 h-4 absolute left-3.5 top-3 z-10 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="text"
                  placeholder="ค้นหาข้อความข้างในเอกสาร, แท็ก, หรือรหัสเอกสาร (Full-Text Search)..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => searchQuery.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      fetchDocs(searchQuery);
                    }
                  }}
                  className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none transition ${isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-600'}`}
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-2xl z-50 overflow-hidden divide-y animate-in fade-in duration-100 ${isDark ? 'bg-slate-900 border-slate-700 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
                    <div className={`p-2 text-[10px] font-semibold flex items-center justify-between ${isDark ? 'bg-slate-950/60 text-cyan-400' : 'bg-slate-50 text-cyan-600'}`}>
                      <span>✨ คำแนะนำที่เกี่ยวข้อง (Search Suggestions):</span>
                      <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition ${isDark ? 'text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300' : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-700'}`}
                      >
                        <span className="truncate">{item}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ค้นหา ↵</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
                  showAdvancedFilter || selectedDept || selectedBranch || startDate || endDate
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-500'
                    : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
                title="ตัวกรองขั้นสูง"
              >
                <Filter className="w-3.5 h-3.5" /> ตัวกรอง
              </button>

              <button
                onClick={() => {
                  setShowSuggestions(false);
                  fetchDocs(searchQuery);
                }}
                className="px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition"
              >
                ค้นหา
              </button>
            </div>

            {selectedDocIds.length > 0 && (
              <div className={`p-2.5 border rounded-xl flex items-center justify-between text-xs animate-fadeIn ${isDark ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300' : 'bg-cyan-50 border-cyan-300 text-cyan-800'}`}>
                <div className="flex items-center gap-2 font-medium">
                  <CheckSquare className="w-4 h-4 text-cyan-500" /> เลือกอยู่ {selectedDocIds.length} รายการ
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportSelected}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export ที่เลือก ({selectedDocIds.length})
                  </button>

                  {currentUser.role === 'ADMIN' && (
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> ลบที่เลือกทั้งหมด
                    </button>
                  )}
                </div>
              </div>
            )}

            {showAdvancedFilter && (
              <div className={`p-3.5 border rounded-xl space-y-3 ${isDark ? 'bg-[#0c1322] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`flex items-center justify-between text-xs pb-2 border-b font-medium ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <span className="flex items-center gap-1.5 text-cyan-500 font-semibold">
                    <Filter className="w-3.5 h-3.5" /> กำหนดเงื่อนไขการค้นหาละเอียด
                  </span>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] hover:text-rose-500 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> ล้างตัวกรองทั้งหมด
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>แผนก</label>
                    <select
                      value={selectedDept || ''}
                      onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : null)}
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="">ทุกแผนก</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>สาขา</label>
                    <select
                      value={selectedBranch || ''}
                      onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="">ทุกสาขา</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ถึงวันที่</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCat(null)}
                className={`px-3 py-1.5 rounded-lg border transition shrink-0 ${
                  selectedCat === null
                    ? isDark ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold' : 'bg-cyan-600 text-white border-cyan-600 font-semibold'
                    : isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(c.id)}
                  className={`px-3 py-1.5 rounded-lg border transition shrink-0 ${
                    selectedCat === c.id
                      ? isDark ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold' : 'bg-cyan-600 text-white border-cyan-600 font-semibold'
                      : isDark ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <thead className={`border-b uppercase text-[10px] ${isDark ? 'bg-slate-800/50 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <button type="button" onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-cyan-500">
                        {selectedDocIds.length > 0 && selectedDocIds.length === docs.length ? (
                          <CheckSquare className="w-4 h-4 text-cyan-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">เอกสาร</th>
                    <th className="py-3 px-3">หมวดหมู่ / แผนก / สาขา</th>
                    <th className="py-3 px-3">รหัส</th>
                    <th className="py-3 px-3">วันที่</th>
                    <th className="py-3 px-3">สิทธิ์</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                  {docs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        ไม่มีรายการเอกสาร หรือคุณไม่มีสิทธิ์เข้าถึงเอกสารในส่วนนี้
                      </td>
                    </tr>
                  ) : (
                    docs.map((doc) => (
                      <tr key={doc.id} className={`transition ${
                        selectedDocIds.includes(doc.id) 
                          ? isDark ? 'bg-cyan-950/20' : 'bg-cyan-50/70' 
                          : isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                      }`}>
                        <td className="py-3 px-3">
                          <button type="button" onClick={() => toggleSelectDoc(doc.id)} className="p-0.5 text-slate-400 hover:text-cyan-500">
                            {selectedDocIds.includes(doc.id) ? (
                              <CheckSquare className="w-4 h-4 text-cyan-500" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className={`py-3 px-3 font-medium max-w-[180px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          <div className="flex items-center gap-1.5">
                            {isExcelOrSpreadsheet(doc.file_name) && (
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="truncate">{doc.title}</span>
                            <span className={`px-1.5 py-0.2 border rounded text-[9px] shrink-0 font-mono ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
                              v{doc.current_version || 1}
                            </span>
                          </div>
                          {doc.tags && (
                            <span className="inline-block mt-0.5 text-[9px] text-cyan-500 font-mono">
                              {doc.tags}
                            </span>
                          )}
                          {doc.snippet && (
                            <span className="block text-[10px] text-slate-400 font-normal truncate mt-0.5">
                              {doc.snippet}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{doc.category_name}</span>
                          <span className="text-[10px] text-slate-400 block">{doc.department_name} • {doc.branch_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono">{doc.document_code}</td>
                        <td className="py-3 px-3 text-slate-400">{doc.document_date}</td>
                        <td className="py-3 px-3">
                          {doc.is_public ? (
                            <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> สาธารณะ
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> จำกัดสิทธิ์
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {doc.status === 'COMPLETED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> พร้อมใช้งาน
                            </span>
                          ) : doc.status === 'FAILED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 inline-flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> ล้มเหลว
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 animate-spin" /> กำลังวิเคราะห์
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => openInspector(doc.id)}
                            className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200'}`}
                            title="เปิด Inspector ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL พรีวิวไฟล์เดี่ยว */}
      {showFullPreviewModal && selectedSingleFile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-5xl h-[88vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-[#0f172a] border-cyan-500/30' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-3.5 border-b flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                {isExcelOrSpreadsheet(selectedSingleFile.name, selectedSingleFile.type) ? (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                ) : (
                  <FileIcon className="w-4 h-4 text-cyan-500" />
                )}
                <h3 className={`text-sm font-bold truncate max-w-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSingleFile.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(selectedSingleFile.size)})</span>
              </div>
              <button
                onClick={() => setShowFullPreviewModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-900/60 overflow-hidden">
              {isExcelOrSpreadsheet(selectedSingleFile.name, selectedSingleFile.type) ? (
                <ExcelSheetViewer fileBlob={selectedSingleFile} />
              ) : (
                previewBlobUrl && (
                  <iframe src={previewBlobUrl} className="w-full h-full border-0" title="Full Pre-upload Preview" />
                )
              )}
            </div>

            <div className={`px-6 py-2.5 border-t flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[11px] text-slate-400">ตรวจสอบความเรียบร้อยของเอกสารก่อนกดปุ่มอัปโหลด</span>
              <button
                onClick={() => setShowFullPreviewModal(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL พรีวิวไฟล์ Bulk */}
      {previewModalFile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-5xl h-[88vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-[#0f172a] border-cyan-500/30' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-3.5 border-b flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                {isExcelOrSpreadsheet(previewModalFile.name) ? (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                ) : (
                  <FileIcon className="w-4 h-4 text-cyan-500" />
                )}
                <h3 className={`text-sm font-bold truncate max-w-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{previewModalFile.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(previewModalFile.size)})</span>
              </div>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-900/60 overflow-hidden">
              {isExcelOrSpreadsheet(previewModalFile.name) ? (
                previewModalFile.rawFile ? (
                  <ExcelSheetViewer fileBlob={previewModalFile.rawFile} />
                ) : (
                  <ExcelSheetViewer fileUrl={previewModalFile.url} />
                )
              ) : (
                <iframe src={previewModalFile.url} className="w-full h-full border-0" title="Bulk Pre-upload Preview" />
              )}
            </div>

            <div className={`px-6 py-2.5 border-t flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[11px] text-slate-400">ตรวจสอบความเรียบร้อยของไฟล์ในชุดก่อนอัปโหลด</span>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Live Scanner Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-lg border rounded-2xl shadow-2xl p-5 flex flex-col items-center ${isDark ? 'bg-[#0f172a] border-cyan-500/30' : 'bg-white border-slate-200'}`}>
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-700/50 mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-500" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>ถ่ายภาพเอกสาร / Live Scanner</h3>
              </div>
              <button onClick={() => setShowCameraModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-inner">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-6 border-2 border-cyan-400/70 border-dashed rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[11px] text-cyan-300 font-medium bg-black/60 px-2 py-1 rounded-md">
                  จัดวางเอกสารให้อยู่ในกรอบ
                </span>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="w-full flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                className={`p-2.5 border rounded-xl transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                title="สลับกล้องหน้า/หลัง"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="w-14 h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full border-4 border-white/20 shadow-xl shadow-cyan-500/30 flex items-center justify-center active:scale-95 transition"
                title="กดถ่ายภาพ"
              >
                <div className="w-5 h-5 bg-white rounded-full" />
              </button>

              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl border rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#0f172a] border-cyan-500/30' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>รายงานสถิติและสัดส่วนเอกสาร (Analytics Dashboard)</h3>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`border rounded-xl p-4 space-y-3 ${isDark ? 'bg-[#070b14] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="text-xs font-bold text-cyan-500 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> สัดส่วนเอกสารแยกตามแผนก
                </h4>
                <div className="space-y-2.5 pt-2">
                  {stats.department_breakdown.length === 0 ? (
                    <p className="text-xs text-slate-400">ยังไม่มีข้อมูล</p>
                  ) : (
                    stats.department_breakdown.map((dept, idx) => {
                      const percentage = stats.total_documents > 0 ? (dept.count / stats.total_documents) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className={`flex justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            <span>{dept.name}</span>
                            <span className="font-mono text-cyan-500">{dept.count} ฉบับ ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className={`border rounded-xl p-4 space-y-3 ${isDark ? 'bg-[#070b14] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4" /> สัดส่วนเอกสารแยกตามประเภท
                </h4>
                <div className="space-y-2.5 pt-2">
                  {stats.category_breakdown.length === 0 ? (
                    <p className="text-xs text-slate-400">ยังไม่มีข้อมูล</p>
                  ) : (
                    stats.category_breakdown.map((cat, idx) => {
                      const percentage = stats.total_documents > 0 ? (cat.count / stats.total_documents) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className={`flex justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            <span>{cat.name}</span>
                            <span className="font-mono text-amber-500">{cat.count} ฉบับ ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {activeDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-6xl border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0f172a] border-cyan-500/30' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <div>
                <div className="flex items-center gap-2">
                  {isExcelOrSpreadsheet(activeDoc.file_name, activeDoc.mime_type) && (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeDoc.title}</h3>
                  <span className={`px-2 py-0.5 border rounded-md text-[10px] font-mono font-bold ${isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}`}>
                    v{activeDoc.current_version || 1}
                  </span>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 border ${isDark ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                    <Eye className="w-3.5 h-3.5 text-indigo-500" /> เปิดดูแล้ว {activeDoc.view_count || 1} ครั้ง
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  รหัส: {activeDoc.document_code} | หมวด: {activeDoc.category_name} | แผนก: {activeDoc.department_name} | สาขา: {activeDoc.branch_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintSlip(true)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'}`}
                  title="พิมพ์ใบปะหน้าสรุปเอกสาร (Document Slip)"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-500" /> พิมพ์สรุป (Print Slip)
                </button>

                <label className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> อัปโหลดเวอร์ชันใหม่
                  <input
                    ref={newVersionInputRef}
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.xlsx,.xls,.csv"
                    onChange={handleUploadNewVersion}
                  />
                </label>

                <button
                  onClick={handleRetryOcr}
                  disabled={retryingOcr}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  title="สั่งประมวลผล OCR อีกครั้ง"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retryingOcr ? 'animate-spin' : ''}`} /> ลองวิเคราะห์ใหม่
                </button>

                <a
                  href={getSafePreviewUrl(activeDoc.download_url) ? `${getSafePreviewUrl(activeDoc.download_url)}?download=true&username=${currentUser.username}` : '#'}
                  download={activeDoc.file_name}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                </a>

                <button
                  onClick={() => setActiveDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
              <div className={`border rounded-xl overflow-hidden flex flex-col h-[520px] ${isDark ? 'bg-[#070b14] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`px-4 py-2 border-b text-[11px] flex items-center justify-between ${isDark ? 'bg-[#0c1322] border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                  <div className="flex items-center gap-2">
                    {isExcelOrSpreadsheet(activeDoc.file_name, activeDoc.mime_type) ? (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-cyan-500" />
                    )}
                    เอกสารต้นฉบับ ({activeDoc.file_name})
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVersionTab(!showVersionTab)}
                    className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                  >
                    <GitCommit className="w-3 h-3" /> {showVersionTab ? 'ซ่อนประวัติเวอร์ชัน' : `ประวัติเวอร์ชัน (${versionHistory.length})`}
                  </button>
                </div>

                {showVersionTab ? (
                  <div className={`flex-1 p-4 overflow-y-auto space-y-2 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                    <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>ประวัติการอัปโหลดแต่ละเวอร์ชัน:</h4>
                    {versionHistory.map((v) => (
                      <div key={v.id} className={`p-3 border rounded-xl flex items-center justify-between text-xs ${isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                        <div>
                          <span className="font-bold text-cyan-500 font-mono">v{v.version}</span> - <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{v.file_name}</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">โดย: {v.created_by} | {new Date(v.created_at).toLocaleString('th-TH')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 bg-slate-900/40 overflow-hidden">
                    {isExcelOrSpreadsheet(activeDoc.file_name, activeDoc.mime_type) ? (
                      <ExcelSheetViewer fileUrl={getSafePreviewUrl(activeDoc.download_url)} />
                    ) : (
                      <iframe
                        src={getSafePreviewUrl(activeDoc.download_url)}
                        className="w-full h-full border-0"
                        title="Document Preview"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className={`border rounded-xl p-2.5 ${isDark ? 'bg-[#1e293b]/60 border-slate-700/60' : 'bg-emerald-50/60 border-emerald-200'}`}>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ยอดเงินสุทธิ</p>
                    <p className="text-xs font-bold text-emerald-500 mt-0.5 truncate">
                      {activeDoc.smart_meta?.total_amount
                        ? `฿${activeDoc.smart_meta.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </p>
                  </div>
                  <div className={`border rounded-xl p-2.5 ${isDark ? 'bg-[#1e293b]/60 border-slate-700/60' : 'bg-cyan-50/60 border-cyan-200'}`}>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>เลขผู้เสียภาษี</p>
                    <p className="text-xs font-bold text-cyan-500 mt-0.5 truncate font-mono">
                      {activeDoc.smart_meta?.tax_id || '-'}
                    </p>
                  </div>
                  <div className={`border rounded-xl p-2.5 ${isDark ? 'bg-[#1e293b]/60 border-slate-700/60' : 'bg-amber-50/60 border-amber-200'}`}>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>องค์กร/บริษัท</p>
                    <p className="text-xs font-bold text-amber-500 mt-0.5 truncate">
                      {activeDoc.smart_meta?.organization || '-'}
                    </p>
                  </div>
                </div>

                {activeDoc.structured_data?.summary && (
                  <div className={`p-3 border rounded-xl text-xs flex items-start gap-2 shadow-inner ${isDark ? 'bg-cyan-950/40 border-cyan-700/40 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900'}`}>
                    <Sparkles className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                    <div>
                      <span className={`font-semibold block mb-0.5 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>สรุปใจความสำคัญ (AI Summary):</span>
                      {activeDoc.structured_data.summary}
                    </div>
                  </div>
                )}

                <div>
                  <label className={`text-[10px] block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>แท็กประจำเอกสาร</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="#ด่วน, #ใบเสร็จ"
                    className={`w-full border rounded-lg px-3 py-1.5 text-xs outline-none ${isDark ? 'bg-[#0c1322] border-slate-700 text-cyan-300 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-cyan-700 focus:border-cyan-600'}`}
                  />
                </div>

                <div className={`flex-1 flex flex-col border rounded-xl p-4 min-h-[260px] ${isDark ? 'bg-[#070b14] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectorTab('ocr')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                          inspectorTab === 'ocr' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-400 hover:text-white bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 bg-slate-200'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> ข้อความสกัดได้ (Text/OCR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab('json')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                          inspectorTab === 'json' ? 'bg-cyan-600 text-white' : isDark ? 'text-slate-400 hover:text-white bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 bg-slate-200'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" /> ข้อมูลโครงสร้าง (JSON)
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyText}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition border ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> คัดลอก
                          </>
                        )}
                      </button>

                      {inspectorTab === 'ocr' && (
                        <button
                          onClick={handleDownloadTxt}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition border ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}
                        >
                          <FileDown className="w-3.5 h-3.5 text-cyan-500" /> บันทึกเป็น .txt
                        </button>
                      )}
                    </div>
                  </div>

                  {inspectorTab === 'ocr' ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="ยังไม่มีข้อความที่สกัดได้ หรืออยู่ระหว่างการประมวลผล..."
                      className={`w-full flex-1 min-h-[200px] border rounded-lg p-3 text-xs font-mono outline-none resize-none leading-relaxed ${isDark ? 'bg-[#0c1322] border-slate-700/80 text-slate-200 focus:border-cyan-500' : 'bg-white border-slate-300 text-slate-800 focus:border-cyan-600'}`}
                    />
                  ) : (
                    <div className={`w-full flex-1 min-h-[200px] border rounded-lg p-3 text-xs font-mono overflow-y-auto max-h-56 ${isDark ? 'bg-[#0c1322] border-slate-700/80 text-emerald-400' : 'bg-white border-slate-300 text-emerald-600'}`}>
                      <pre>{JSON.stringify(activeDoc.structured_data || {}, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`px-6 py-3.5 border-t flex items-center justify-between ${isDark ? 'bg-[#131d33] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {currentUser.role === 'ADMIN' ? (
                <button
                  onClick={() => handleDelete(activeDoc.id)}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ลบเอกสาร
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
                >
                  <Save className="w-3.5 h-3.5" /> {savingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
                <button
                  onClick={() => setActiveDoc(null)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Slip Modal */}
      {showPrintSlip && activeDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div className="flex items-center gap-3">
                <img src="/jib-logo.png" alt="Logo" className="h-10 object-contain" />
                <div>
                  <h2 className="text-lg font-bold">ใบสรุปข้อมูลเอกสาร (Document Slip)</h2>
                  <p className="text-xs text-slate-500">J-Document Digital Management System</p>
                </div>
              </div>
              <button onClick={() => setShowPrintSlip(false)} className="text-slate-400 hover:text-slate-700 text-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-12 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="col-span-8 text-xs space-y-1.5">
                <p><span className="text-slate-500 font-medium">ชื่อเอกสาร:</span> <strong className="text-slate-900">{activeDoc.title}</strong></p>
                <p><span className="text-slate-500 font-medium">รหัสเอกสาร:</span> <strong className="font-mono text-indigo-600">{activeDoc.document_code}</strong></p>
                <p><span className="text-slate-500 font-medium">เวอร์ชันปัจจุบัน:</span> <strong>v{activeDoc.current_version || 1}</strong></p>
                <p><span className="text-slate-500 font-medium">หมวดหมู่:</span> {activeDoc.category_name} | <span className="text-slate-500 font-medium">แผนก:</span> {activeDoc.department_name}</p>
                <p><span className="text-slate-500 font-medium">สาขา:</span> {activeDoc.branch_name}</p>
                <p><span className="text-slate-500 font-medium">แท็กกำกับ:</span> <span className="text-cyan-600 font-mono">{activeDoc.tags || '-'}</span></p>
              </div>

              <div className="col-span-4 flex flex-col items-center justify-center border-l pl-4 border-slate-200">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`DMS-DOC:${activeDoc.document_code}`)}`} 
                  alt="QR Code" 
                  className="w-20 h-20"
                />
                <span className="text-[9px] text-slate-400 mt-1 font-mono">SCAN TO VERIFY</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center mb-6">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-[10px] text-emerald-600">ยอดเงินสุทธิ</p>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">
                  {activeDoc.smart_meta?.total_amount ? `฿${activeDoc.smart_meta.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[10px] text-blue-600">เลขประจำตัวผู้เสียภาษี</p>
                <p className="text-xs font-bold text-blue-700 mt-1 font-mono">{activeDoc.smart_meta?.tax_id || '-'}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[10px] text-amber-600">องค์กร/บริษัท</p>
                <p className="text-xs font-bold text-amber-800 mt-1 truncate">{activeDoc.smart_meta?.organization || '-'}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-700 mb-2">เนื้อหาเอกสาร (OCR / Extracted Text):</h4>
              <div className="p-3 bg-slate-100 rounded-lg text-[11px] font-mono leading-relaxed text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap border border-slate-200">
                {activeDoc.extracted_text || 'ไม่มีข้อมูลข้อความในเอกสาร'}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <p className="text-[10px] text-slate-400">พิมพ์โดย: {currentUser.full_name} ({new Date().toLocaleString('th-TH')})</p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" /> สั่งพิมพ์หน้านี้ (Print / PDF)
                </button>
                <button
                  onClick={() => setShowPrintSlip(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl border rounded-2xl shadow-2xl p-6 flex flex-col max-h-[80vh] ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>ประวัติการใช้งานระบบ (Audit Logs)</h3>
              </div>
              <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`overflow-y-auto flex-1 divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {logs.map((l) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-cyan-500">[{l.action}]</span>{' '}
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{l.username}</span> - <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{l.details}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleString('th-TH')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl border rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh] ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>จัดการผู้ใช้งาน (User Management)</h3>
              </div>
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ฟอร์มเพิ่ม/แก้ไข */}
            {editingUser ? (
              <form onSubmit={handleUpdateUser} className={`p-4 rounded-xl border mb-4 space-y-3 ${isDark ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-indigo-50/50 border-indigo-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-500 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> แก้ไขข้อมูล: {editingUser.username}
                  </span>
                  <button type="button" onClick={() => setEditingUser(null)} className="text-[11px] text-slate-400 hover:underline">
                    ยกเลิกการแก้ไข
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    placeholder="ชื่อ-นามสกุล"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className={`border rounded-lg px-3 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    required
                  />
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(Number(e.target.value))}
                    className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <input
                    type="password"
                    placeholder="รหัสผ่านใหม่ (เว้นว่างได้)"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className={`border rounded-lg px-3 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow">
                    บันทึกการแก้ไข
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateUser} className={`grid grid-cols-5 gap-2 mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <input
                  type="text"
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  required
                />
                <input
                  type="text"
                  placeholder="ชื่อ-นามสกุล"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  required
                />
                <select
                  value={newUserDeptId}
                  onChange={(e) => setNewUserDeptId(Number(e.target.value))}
                  className={`border rounded-lg px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className={`border rounded-lg px-1.5 py-1.5 text-xs outline-none flex-1 ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shrink-0">
                    เพิ่ม
                  </button>
                </div>
              </form>
            )}

            {/* ตารางแสดงรายชื่อผู้ใช้ */}
            <div className="overflow-y-auto flex-1">
              <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <thead className={`uppercase text-[10px] ${isDark ? 'bg-slate-800/40 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <tr>
                    <th className="py-2 px-3">Username</th>
                    <th className="py-2 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2 px-3">แผนก</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {usersList.map((u) => (
                    <tr key={u.id} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                      <td className={`py-2.5 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.username}</td>
                      <td className="py-2.5 px-3">{u.full_name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{u.department_name || 'ไม่ระบุ'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-500' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditUser(u)}
                            className="p-1 text-slate-400 hover:text-indigo-400 transition"
                            title="แก้ไขข้อมูลผู้ใช้"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {u.username !== 'admin' && u.username !== currentUser?.username && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition"
                              title={`ลบผู้ใช้ ${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Master Data Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl border rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh] ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-500" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>จัดการข้อมูลหลัก (Master Data: หมวดหมู่, แผนก, สาขา)</h3>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-amber-500 flex items-center gap-1"><Tag className="w-3 h-3" /> หมวดหมู่</h4>
                <form onSubmit={handleAddCategory} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มหมวดหมู่..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className={`flex-1 border rounded-lg px-2.5 py-1 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                  />
                  <button type="submit" className="px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className={`divide-y p-2 rounded-lg max-h-56 overflow-y-auto ${isDark ? 'divide-slate-800 bg-slate-900/50 text-slate-300' : 'divide-slate-200 bg-slate-50 text-slate-700'}`}>
                  {categories.map((c) => (
                    <div key={c.id} className="py-1 text-xs flex items-center justify-between">
                      <span>• {c.name}</span>
                      <button type="button" onClick={() => handleDeleteCategory(c.id)} className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-cyan-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> แผนก</h4>
                <form onSubmit={handleAddDept} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มแผนก..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className={`flex-1 border rounded-lg px-2.5 py-1 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                  />
                  <button type="submit" className="px-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className={`divide-y p-2 rounded-lg max-h-56 overflow-y-auto ${isDark ? 'divide-slate-800 bg-slate-900/50 text-slate-300' : 'divide-slate-200 bg-slate-50 text-slate-700'}`}>
                  {departments.map((d) => (
                    <div key={d.id} className="py-1 text-xs flex items-center justify-between">
                      <span>• {d.name}</span>
                      <button type="button" onClick={() => handleDeleteDept(d.id)} className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-indigo-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> สาขา</h4>
                <form onSubmit={handleAddBranch} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มสาขา..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className={`flex-1 border rounded-lg px-2.5 py-1 text-xs outline-none ${isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                  />
                  <button type="submit" className="px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className={`divide-y p-2 rounded-lg max-h-56 overflow-y-auto ${isDark ? 'divide-slate-800 bg-slate-900/50 text-slate-300' : 'divide-slate-200 bg-slate-50 text-slate-700'}`}>
                  {branches.map((b) => (
                    <div key={b.id} className="py-1 text-xs flex items-center justify-between">
                      <span>• {b.name}</span>
                      <button type="button" onClick={() => handleDeleteBranch(b.id)} className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}