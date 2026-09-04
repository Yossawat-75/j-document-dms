import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Search, UploadCloud, Eye, Trash2, CheckCircle2, 
  Clock, AlertCircle, Download, FileSpreadsheet, History, LogOut, 
  DollarSign, Building2, UserCheck, Users, FolderPlus,
  Edit3, Save, X, Copy, Check, FileDown, Layers, File,
  Filter, RotateCcw, Tag, MapPin, Bell, RefreshCw, GitCommit, Upload,
  BarChart3, PieChart, Printer, CheckSquare, Square, Code, Sparkles,
  Camera, SwitchCamera, ScanLine
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

const getSafePreviewUrl = (url: string | undefined | null) => {
  if (!url) return '';
  const backendOrigin = API_BASE.replace(/\/api$/, '');
  return url
    .replace('http://localhost:8000', backendOrigin)
    .replace('http://127.0.0.1:8000', backendOrigin);
};

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface DocItem {
  id: string;
  title: string;
  document_code: string;
  document_date: string;
  status: string;
  file_name: string;
  current_version?: number;
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
    const saved = localStorage.getItem('dms_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('admin123');
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
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadCatId, setUploadCatId] = useState(1);
  const [uploadDeptId, setUploadDeptId] = useState(1);
  const [uploadBranchId, setUploadBranchId] = useState(1);
  const [uploadTags, setUploadTags] = useState('');
  const [selectedSingleFile, setSelectedSingleFile] = useState<globalThis.File | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [bulkFiles, setBulkFiles] = useState<globalThis.File[]>([]);
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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');

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
    fetchDocs();
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
      
      localStorage.setItem('dms_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
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
      if (data.categories?.length > 0) setUploadCatId(data.categories[0].id);
      if (data.departments?.length > 0) setUploadDeptId(data.departments[0].id);
      if (data.branches?.length > 0) setUploadBranchId(data.branches[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocs = async () => {
    try {
      let url = `${API_BASE}/documents/search?`;
      if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`;
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
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setTimeout(() => {
      fetchDocs();
    }, 50);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedCat(null);
    setSelectedDept(null);
    setSelectedBranch(null);
    setStartDate('');
    setEndDate('');
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
      if (isBulk) {
        if (bulkFiles.length === 0) {
          alert('กรุณาเลือกหรือสแกนไฟล์อย่างน้อย 1 ไฟล์');
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append('category_id', uploadCatId.toString());
        formData.append('department_id', uploadDeptId.toString());
        formData.append('branch_id', uploadBranchId.toString());
        formData.append('tags', uploadTags);
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
        formData.append('department_id', uploadDeptId.toString());
        formData.append('branch_id', uploadBranchId.toString());
        formData.append('tags', uploadTags);
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
        clearSingleFile();
        setUploadCode(`DOC-${Math.floor(1000 + Math.random() * 9000)}`);
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
      const res = await fetch(`${API_BASE}/documents/${id}?username=${currentUser?.username}`);
      const data: DocDetail = await res.json();
      setActiveDoc(data);
      setInspectorTab('ocr');
      setEditTitle(data.title);
      setEditText(data.extracted_text || '');
      setEditTags(data.tags || '');
      setCopied(false);
      setShowVersionTab(false);

      fetch(`${API_BASE}/documents/${id}/versions`)
        .then(r => r.json())
        .then(vData => setVersionHistory(vData.versions || []));
    } catch (err) {
      alert('ไม่สามารถโหลดข้อมูลเอกสารได้');
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
    try {
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err) {
      console.error(err);
    }
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
          role: newRole
        })
      });
      if (!res.ok) throw new Error('ไม่สามารถสร้างผู้ใช้ได้ (Username ซ้ำ)');
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      openUserManagement();
      showToast('เพิ่มผู้ใช้งานใหม่เรียบร้อย (Bcrypt Secured)');
    } catch (err: any) {
      alert(err.message);
    }
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
      openUserManagement();
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
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-white rounded-2xl mb-3 shadow-xl shadow-cyan-500/10 flex items-center justify-center w-28 h-16">
              <img src="/jib-logo.png" alt="J-Document Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">J-Document DMS</h1>
            <p className="text-slate-400 text-xs mt-1">ระบบจัดการเอกสารดิจิทัล</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-2.5 text-sm text-white outline-none transition"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-2.5 text-sm text-white outline-none transition"
                required
              />
            </div>

            <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
              <p><strong className="text-amber-400">🔑 Admin:</strong> admin / admin123 (สิทธิ์เต็ม & Audit Logs)</p>
              <p><strong className="text-cyan-400">👤 User:</strong> user / user123 (อัปโหลดและสืบค้นเอกสาร)</p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 rotate-180" /> เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans pb-12">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 border border-cyan-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-bounce">
          <Bell className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium">{toastMsg}</span>
        </div>
      )}

      <header className="border-b border-slate-800 bg-[#0c1322]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded-lg shadow-md flex items-center justify-center w-12 h-9">
            <img src="/jib-logo.png" alt="J-Document Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">J-Document DMS</h1>
            <p className="text-[11px] text-slate-400">ระบบจัดการเอกสารดิจิทัล</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-full flex items-center gap-2 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white font-medium">{currentUser.full_name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${currentUser.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-700 text-slate-300'}`}>
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition text-cyan-400 hover:text-cyan-300"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Analytics Chart
          </button>

          <a
            href={`${API_BASE}/documents/export`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition text-slate-300 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </a>

          {currentUser.role === 'ADMIN' && (
            <>
              <button
                onClick={openUserManagement}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition text-slate-300 hover:text-white"
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Users
              </button>

              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition text-slate-300 hover:text-white"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> Master Data
              </button>

              <button
                onClick={openLogsModal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition text-slate-300 hover:text-white"
              >
                <History className="w-3.5 h-3.5 text-cyan-400" /> Audit Logs
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-medium text-rose-400 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> ออก
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">เอกสารทั้งหมด</p>
              <h3 className="text-xl font-bold text-white">{stats.total_documents} <span className="text-xs font-normal text-slate-400">ฉบับ</span></h3>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">OCR เสร็จสิ้น</p>
              <h3 className="text-xl font-bold text-white">{stats.completed_documents} <span className="text-xs font-normal text-slate-400">ฉบับ</span></h3>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">ยอดเงินรวมในระบบ</p>
              <h3 className="text-xl font-bold text-white">฿{stats.total_amount_extracted.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">หมวดหมู่ยอดนิยม</p>
              <h3 className="text-base font-bold text-white truncate max-w-[150px]">{stats.top_category}</h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">
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
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition"
              >
                <Layers className="w-3 h-3" /> {isBulk ? 'สลับเป็นรายไฟล์' : 'สลับเป็น Bulk Upload'}
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-3.5">
              {!isBulk && (
                <>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ชื่อเอกสาร *</label>
                    <input
                      type="text"
                      placeholder="เช่น ใบเสร็จจัดซื้ออุปกรณ์ IT"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">รหัสเอกสาร</label>
                      <input
                        type="text"
                        value={uploadCode}
                        onChange={(e) => setUploadCode(e.target.value)}
                        className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">วันที่</label>
                      <input
                        type="date"
                        value={uploadDate}
                        onChange={(e) => setUploadDate(e.target.value)}
                        className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">หมวดหมู่</label>
                  <select
                    value={uploadCatId}
                    onChange={(e) => setUploadCatId(Number(e.target.value))}
                    className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-2 py-2 text-xs text-white outline-none transition"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">แผนก</label>
                  <select
                    value={uploadDeptId}
                    onChange={(e) => setUploadDeptId(Number(e.target.value))}
                    className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-2 py-2 text-xs text-white outline-none transition"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">สาขา</label>
                  <select
                    value={uploadBranchId}
                    onChange={(e) => setUploadBranchId(Number(e.target.value))}
                    className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-2 py-2 text-xs text-white outline-none transition"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">แท็กกำกับเอกสาร (คั่นด้วยจุลภาค เช่น #ด่วน, #ใบเสร็จ)</label>
                <input
                  type="text"
                  placeholder="#ด่วน, #งบประมาณ2569"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  {isBulk ? 'แนบไฟล์เอกสารหลายรายการ (Bulk)' : 'แนบไฟล์เอกสาร (PDF หรือ รูปภาพ)'}
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
                      : 'border-slate-700 hover:border-cyan-500/50 bg-[#141e33]/50 hover:bg-[#141e33]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">ลากไฟล์มาวางที่นี่</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">หรือคลิกเพื่อเลือกไฟล์จากเครื่อง</p>
                  </div>
                  <span className="text-[9px] px-2.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-full font-mono">
                    PDF, JPG, PNG — สูงสุด 50 MB/ไฟล์
                  </span>
                </div>

                <input
                  ref={singleFileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />

                <input
                  ref={bulkFileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={handleBulkFileChange}
                  className="hidden"
                />
              </div>

              <div className="p-3 bg-[#111c30] border border-cyan-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">ถ่ายภาพ / สแกนเอกสาร</h4>
                    <p className="text-[10px] text-slate-400">เปิดกล้องเพื่อถ่ายภาพเอกสารสด</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Camera className="w-3.5 h-3.5" /> เปิดกล้อง
                </button>
              </div>

              {!isBulk && selectedSingleFile && previewBlobUrl && (
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-900/80 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <File className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs text-white font-medium truncate">{selectedSingleFile.name}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(selectedSingleFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearSingleFile}
                      className="p-1 text-slate-400 hover:text-rose-400 transition"
                      title="ยกเลิกไฟล์นี้"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="h-44 border border-slate-800 rounded-xl overflow-hidden bg-black/40">
                    <iframe src={previewBlobUrl} className="w-full h-full border-0" title="Pre-upload preview" />
                  </div>
                </div>
              )}

              {isBulk && bulkFiles.length > 0 && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  <div className="text-[11px] font-semibold text-cyan-400 flex items-center justify-between">
                    <span>รายการไฟล์ที่เตรียมอัปโหลด ({bulkFiles.length} รายการ):</span>
                    <button
                      type="button"
                      onClick={clearAllBulkFiles}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                  {bulkFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-900/80 border border-slate-700/80 rounded-lg flex items-center justify-between hover:border-cyan-500/30 transition"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <File className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[11px] text-white truncate">{file.name}</p>
                          <p className="text-[9px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBulkFile(idx)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition ml-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
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

          <div className="lg:col-span-8 bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex gap-2 relative" ref={searchContainerRef}>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 z-10" />
                <input
                  type="text"
                  placeholder="ค้นหาข้อความข้างในเอกสาร, แท็ก, หรือรหัสเอกสาร (Full-Text Search)..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => searchQuery.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      fetchDocs();
                    }
                  }}
                  className="w-full bg-[#1e293b] border border-slate-700 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800/80 animate-in fade-in duration-100">
                    <div className="p-2 bg-slate-950/60 text-[10px] font-semibold text-cyan-400 flex items-center justify-between">
                      <span>✨ คำแนะนำที่เกี่ยวข้อง (Search Suggestions):</span>
                      <button onClick={() => setShowSuggestions(false)} className="text-slate-500 hover:text-white">✕</button>
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300 flex items-center justify-between transition"
                      >
                        <span className="truncate">{item}</span>
                        <span className="text-[10px] text-slate-500 font-mono">ค้นหา ↵</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
                  showAdvancedFilter || selectedDept || selectedBranch || startDate || endDate
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="ตัวกรองขั้นสูง"
              >
                <Filter className="w-3.5 h-3.5" /> ตัวกรอง
              </button>

              <button
                onClick={() => {
                  setShowSuggestions(false);
                  fetchDocs();
                }}
                className="px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition"
              >
                ค้นหา
              </button>
            </div>

            {selectedDocIds.length > 0 && (
              <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                <div className="flex items-center gap-2 text-cyan-300 font-medium">
                  <CheckSquare className="w-4 h-4" /> เลือกอยู่ {selectedDocIds.length} รายการ
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportSelected}
                    className="px-3 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg font-semibold flex items-center gap-1.5 transition"
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
              <div className="p-3.5 bg-[#0c1322] border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80 font-medium">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <Filter className="w-3.5 h-3.5" /> กำหนดเงื่อนไขการค้นหาละเอียด
                  </span>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> ล้างตัวกรองทั้งหมด
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">แผนก</label>
                    <select
                      value={selectedDept || ''}
                      onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="">ทุกแผนก</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">สาขา</label>
                    <select
                      value={selectedBranch || ''}
                      onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="">ทุกสาขา</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">ถึงวันที่</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
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
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
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
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <button type="button" onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-cyan-400">
                        {selectedDocIds.length > 0 && selectedDocIds.length === docs.length ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">เอกสาร</th>
                    <th className="py-3 px-3">หมวดหมู่ / แผนก / สาขา</th>
                    <th className="py-3 px-3">รหัส</th>
                    <th className="py-3 px-3">วันที่</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {docs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        ไม่มีรายการเอกสาร หรือไม่พบข้อมูลตามคำค้นหา
                      </td>
                    </tr>
                  ) : (
                    docs.map((doc) => (
                      <tr key={doc.id} className={`hover:bg-slate-800/30 transition ${selectedDocIds.includes(doc.id) ? 'bg-cyan-950/20' : ''}`}>
                        <td className="py-3 px-3">
                          <button type="button" onClick={() => toggleSelectDoc(doc.id)} className="p-0.5 text-slate-400 hover:text-cyan-400">
                            {selectedDocIds.includes(doc.id) ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-medium text-white max-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{doc.title}</span>
                            <span className="px-1.5 py-0.2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded text-[9px] shrink-0 font-mono">
                              v{doc.current_version || 1}
                            </span>
                          </div>
                          {doc.tags && (
                            <span className="inline-block mt-0.5 text-[9px] text-cyan-400 font-mono">
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
                          <span className="text-slate-300 block">{doc.category_name}</span>
                          <span className="text-[10px] text-slate-500 block">{doc.department_name} • {doc.branch_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{doc.document_code}</td>
                        <td className="py-3 px-3 text-slate-400">{doc.document_date}</td>
                        <td className="py-3 px-3">
                          {doc.status === 'COMPLETED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> พร้อมใช้งาน
                            </span>
                          ) : doc.status === 'FAILED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> ล้มเหลว
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 animate-spin" /> กำลังวิเคราะห์
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => openInspector(doc.id)}
                            className="p-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 transition"
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

      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0f172a] border border-cyan-500/30 rounded-2xl shadow-2xl p-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">ถ่ายภาพเอกสาร / Live Scanner</h3>
              </div>
              <button
                onClick={() => setShowCameraModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

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
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition"
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
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">รายงานสถิติและสัดส่วนเอกสาร (Analytics Dashboard)</h3>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> สัดส่วนเอกสารแยกตามแผนก
                </h4>
                <div className="space-y-2.5 pt-2">
                  {stats.department_breakdown.length === 0 ? (
                    <p className="text-xs text-slate-500">ยังไม่มีข้อมูล</p>
                  ) : (
                    stats.department_breakdown.map((dept, idx) => {
                      const percentage = stats.total_documents > 0 ? (dept.count / stats.total_documents) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>{dept.name}</span>
                            <span className="font-mono text-cyan-400">{dept.count} ฉบับ ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4" /> สัดส่วนเอกสารแยกตามประเภท
                </h4>
                <div className="space-y-2.5 pt-2">
                  {stats.category_breakdown.length === 0 ? (
                    <p className="text-xs text-slate-500">ยังไม่มีข้อมูล</p>
                  ) : (
                    stats.category_breakdown.map((cat, idx) => {
                      const percentage = stats.total_documents > 0 ? (cat.count / stats.total_documents) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span>{cat.name}</span>
                            <span className="font-mono text-amber-400">{cat.count} ฉบับ ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
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

      {activeDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-6xl bg-[#0f172a] border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#131d33]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{activeDoc.title}</h3>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md text-[10px] font-mono font-bold">
                    v{activeDoc.current_version || 1}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  รหัส: {activeDoc.document_code} | หมวด: {activeDoc.category_name} | แผนก: {activeDoc.department_name} | สาขา: {activeDoc.branch_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintSlip(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  title="พิมพ์ใบปะหน้าสรุปเอกสาร (Document Slip)"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" /> พิมพ์สรุป (Print Slip)
                </button>

                <label className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> อัปโหลดเวอร์ชันใหม่
                  <input
                    ref={newVersionInputRef}
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={handleUploadNewVersion}
                  />
                </label>

                <button
                  onClick={handleRetryOcr}
                  disabled={retryingOcr}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
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
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
              <div className="bg-[#070b14] border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
                <div className="px-4 py-2 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-[#0c1322]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    เอกสารต้นฉบับ ({activeDoc.file_name})
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVersionTab(!showVersionTab)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <GitCommit className="w-3 h-3" /> {showVersionTab ? 'ซ่อนประวัติเวอร์ชัน' : `ประวัติเวอร์ชัน (${versionHistory.length})`}
                  </button>
                </div>

                {showVersionTab ? (
                  <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-900/60">
                    <h4 className="text-xs font-semibold text-white mb-2">ประวัติการอัปโหลดแต่ละเวอร์ชัน:</h4>
                    {versionHistory.map((v) => (
                      <div key={v.id} className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-cyan-400 font-mono">v{v.version}</span> - <span className="text-white font-medium">{v.file_name}</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">โดย: {v.created_by} | {new Date(v.created_at).toLocaleString('th-TH')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 bg-slate-900/40">
                    <iframe
                      src={getSafePreviewUrl(activeDoc.download_url)}
                      className="w-full h-full border-0"
                      title="Document Preview"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-[#1e293b]/60 border border-slate-700/60 rounded-xl p-2.5">
                    <p className="text-[10px] text-slate-400">ยอดเงินสุทธิ</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5 truncate">
                      {activeDoc.smart_meta?.total_amount
                        ? `฿${activeDoc.smart_meta.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-[#1e293b]/60 border border-slate-700/60 rounded-xl p-2.5">
                    <p className="text-[10px] text-slate-400">เลขผู้เสียภาษี</p>
                    <p className="text-xs font-bold text-cyan-400 mt-0.5 truncate font-mono">
                      {activeDoc.smart_meta?.tax_id || '-'}
                    </p>
                  </div>
                  <div className="bg-[#1e293b]/60 border border-slate-700/60 rounded-xl p-2.5">
                    <p className="text-[10px] text-slate-400">องค์กร/บริษัท</p>
                    <p className="text-xs font-bold text-amber-400 mt-0.5 truncate">
                      {activeDoc.smart_meta?.organization || '-'}
                    </p>
                  </div>
                </div>

                {activeDoc.structured_data?.summary && (
                  <div className="p-3 bg-cyan-950/40 border border-cyan-700/40 rounded-xl text-xs text-cyan-200 flex items-start gap-2 shadow-inner">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-cyan-300 block mb-0.5">สรุปใจความสำคัญ (AI Summary):</span>
                      {activeDoc.structured_data.summary}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">แท็กประจำเอกสาร</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="#ด่วน, #ใบเสร็จ"
                    className="w-full bg-[#0c1322] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex-1 flex flex-col bg-[#070b14] border border-slate-800 rounded-xl p-4 min-h-[260px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectorTab('ocr')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                          inspectorTab === 'ocr' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/60'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> ข้อความ OCR
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTab('json')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                          inspectorTab === 'json' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800/60'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" /> ข้อมูลโครงสร้าง (JSON)
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyText}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition border border-slate-700"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> คัดลอก
                          </>
                        )}
                      </button>

                      {inspectorTab === 'ocr' && (
                        <button
                          onClick={handleDownloadTxt}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 transition border border-slate-700"
                        >
                          <FileDown className="w-3 h-3 text-cyan-400" /> บันทึกเป็น .txt
                        </button>
                      )}
                    </div>
                  </div>

                  {inspectorTab === 'ocr' ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="ยังไม่มีข้อความที่สกัดได้ หรืออยู่ระหว่างการประมวลผล..."
                      className="w-full flex-1 min-h-[200px] bg-[#0c1322] border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 font-mono outline-none focus:border-cyan-500 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="w-full flex-1 min-h-[200px] bg-[#0c1322] border border-slate-700/80 rounded-lg p-3 text-xs font-mono overflow-y-auto max-h-56 text-emerald-400">
                      <pre>{JSON.stringify(activeDoc.structured_data || {}, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-800 bg-[#131d33] flex items-center justify-between">
              {currentUser.role === 'ADMIN' ? (
                <button
                  onClick={() => handleDelete(activeDoc.id)}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

            <div className="grid grid-cols-12 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border">
              <div className="col-span-8 text-xs space-y-1.5">
                <p><span className="text-slate-500 font-medium">ชื่อเอกสาร:</span> <strong className="text-slate-900">{activeDoc.title}</strong></p>
                <p><span className="text-slate-500 font-medium">รหัสเอกสาร:</span> <strong className="font-mono text-indigo-600">{activeDoc.document_code}</strong></p>
                <p><span className="text-slate-500 font-medium">เวอร์ชันปัจจุบัน:</span> <strong>v{activeDoc.current_version || 1}</strong></p>
                <p><span className="text-slate-500 font-medium">หมวดหมู่:</span> {activeDoc.category_name} | <span className="text-slate-500 font-medium">แผนก:</span> {activeDoc.department_name}</p>
                <p><span className="text-slate-500 font-medium">สาขา:</span> {activeDoc.branch_name}</p>
                <p><span className="text-slate-500 font-medium">แท็กกำกับ:</span> <span className="text-cyan-600 font-mono">{activeDoc.tags || '-'}</span></p>
              </div>

              <div className="col-span-4 flex flex-col items-center justify-center border-l pl-4">
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
              <h4 className="text-xs font-bold text-slate-700 mb-2">เนื้อหาเอกสาร (OCR Extracted Text):</h4>
              <div className="p-3 bg-slate-100 rounded-lg text-[11px] font-mono leading-relaxed text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap border">
                {activeDoc.extracted_text || 'ไม่มีข้อมูล OCR'}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
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

      {showLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">ประวัติการใช้งานระบบ (Audit Logs)</h3>
              </div>
              <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
              {logs.map((l) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-cyan-400">[{l.action}]</span>{' '}
                    <span className="text-white font-medium">{l.username}</span> - {l.details}
                  </div>
                  <span className="text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString('th-TH')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">จัดการผู้ใช้งาน (User Management)</h3>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-3 mb-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <input
                type="text"
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                required
              />
              <input
                type="text"
                placeholder="ชื่อ-นามสกุล"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                required
              />
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none flex-1"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button
                  type="submit"
                  className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                >
                  เพิ่มผู้ใช้
                </button>
              </div>
            </form>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/40 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Username</th>
                    <th className="py-2 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 text-white font-medium">{u.username}</td>
                      <td className="py-2.5 px-3 text-slate-300">{u.full_name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.username !== 'admin' && u.username !== currentUser?.username && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title={`ลบผู้ใช้ ${u.username}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">จัดการข้อมูลหลัก (Master Data: หมวดหมู่, แผนก, สาขา)</h3>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1"><Tag className="w-3 h-3" /> หมวดหมู่</h4>
                <form onSubmit={handleAddCategory} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มหมวดหมู่..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                  />
                  <button type="submit" className="px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className="divide-y divide-slate-800 bg-slate-900/50 p-2 rounded-lg max-h-56 overflow-y-auto">
                  {categories.map((c) => (
                    <div key={c.id} className="py-1 text-xs text-slate-300 flex items-center justify-between">
                      <span>• {c.name}</span>
                      <button type="button" onClick={() => handleDeleteCategory(c.id)} className="text-slate-500 hover:text-rose-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-cyan-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> แผนก</h4>
                <form onSubmit={handleAddDept} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มแผนก..."
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                  />
                  <button type="submit" className="px-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className="divide-y divide-slate-800 bg-slate-900/50 p-2 rounded-lg max-h-56 overflow-y-auto">
                  {departments.map((d) => (
                    <div key={d.id} className="py-1 text-xs text-slate-300 flex items-center justify-between">
                      <span>• {d.name}</span>
                      <button type="button" onClick={() => handleDeleteDept(d.id)} className="text-slate-500 hover:text-rose-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-indigo-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> สาขา</h4>
                <form onSubmit={handleAddBranch} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="เพิ่มสาขา..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                  />
                  <button type="submit" className="px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">เพิ่ม</button>
                </form>
                <div className="divide-y divide-slate-800 bg-slate-900/50 p-2 rounded-lg max-h-56 overflow-y-auto">
                  {branches.map((b) => (
                    <div key={b.id} className="py-1 text-xs text-slate-300 flex items-center justify-between">
                      <span>• {b.name}</span>
                      <button type="button" onClick={() => handleDeleteBranch(b.id)} className="text-slate-500 hover:text-rose-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
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