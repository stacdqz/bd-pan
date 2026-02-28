"use client";
import { useState, useEffect, useRef } from 'react';

const ALIST_BASE_DEFAULT = (process.env.NEXT_PUBLIC_ALIST_URL || 'http://47.108.222.119:5244').replace(/\/+$/, '');
const SIZE_THRESHOLD = 20 * 1024 * 1024; // 20MB

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const cancelWebNDMRef = useRef<(() => void) | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // AList 文件浏览
  const [alistPath, setAlistPath] = useState('/');
  const [alistFiles, setAlistFiles] = useState<any[]>([]);
  const [alistLoading, setAlistLoading] = useState(false);
  const [alistError, setAlistError] = useState<string | null>(null);
  const [alistMsg, setAlistMsg] = useState<string | null>(null);
  const [alistSelected, setAlistSelected] = useState<Set<string>>(new Set());

  // 文件操作
  const [alistShowMkdir, setAlistShowMkdir] = useState(false);
  const [alistMkdirName, setAlistMkdirName] = useState('');
  const [alistUploadFile, setAlistUploadFile] = useState<File | null>(null);
  const [alistUploading, setAlistUploading] = useState(false);
  const [alistRenaming, setAlistRenaming] = useState<string | null>(null);
  const [alistNewName, setAlistNewName] = useState('');
  const [alistDownloadModal, setAlistDownloadModal] = useState<{ name: string; filePath: string; sign?: string } | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  // === 远端 AList 设置（仅本地生效） ===
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [customPass, setCustomPass] = useState('');

  const getCustomConfig = () => {
    if (typeof window !== 'undefined') {
      try {
        const str = localStorage.getItem('ALIST_CUSTOM_CONFIG');
        if (str) return JSON.parse(str);
      } catch (e) { }
    }
    return null;
  };

  const getAlistBase = () => {
    const cc = getCustomConfig();
    if (cc && cc.url) return cc.url.replace(/\/+$/, '');
    return ALIST_BASE_DEFAULT;
  };

  const fetchAlist = async (body: any, customHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...customHeaders };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

    const cc = getCustomConfig();
    if (cc) {
      if (cc.url) headers['x-alist-url'] = cc.url;
      if (cc.user) headers['x-alist-username'] = cc.user;
      if (cc.pass) headers['x-alist-password'] = cc.pass;
    }

    return fetch('/api/alist', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ALIST_ADMIN_TOKEN');
      if (saved) setAdminToken(saved);

      // 打点跟踪：获取 IP 等基础数据发往后端存入 Supabase view_list 表
      // 捕获可能由于广告拦截等原因导致的失败，加个静默 catch
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: new Date().toISOString(),
              ip: data.ip,
              location: `${data.country_name || ''} ${data.region || ''} ${data.city || ''}`.trim(),
              device: navigator.userAgent,
              source: 'bd-pan' // 这是指定项目的来源
            })
          }).catch(err => console.error('Tracking fetch failed', err));
        })
        .catch(() => {
          // ipapi fetch failed (e.g. adblock or limits), send fallback
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              time: new Date().toISOString(),
              device: navigator.userAgent,
              source: 'bd-pan'
            })
          }).catch(() => { });
        });
    }
    alistListDir('/');
  }, []);

  // 自动清除消息
  useEffect(() => {
    if (alistMsg) {
      const t = setTimeout(() => setAlistMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [alistMsg]);

  // === 登录 ===
  const handleLogin = async () => {
    const pwd = authPassword.trim();
    if (!pwd) { setAuthError('密码不能为空'); return; }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) { setAuthError(data.error || '登录失败'); return; }
      setAdminToken(data.token);
      if (typeof window !== 'undefined') window.localStorage.setItem('ALIST_ADMIN_TOKEN', data.token);
      setAuthPassword('');
    } catch { setAuthError('登录接口异常'); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    setAdminToken(null);
    if (typeof window !== 'undefined') window.localStorage.removeItem('ALIST_ADMIN_TOKEN');
  };

  // === AList 目录列表 ===
  const alistListDir = async (path: string) => {
    setAlistLoading(true);
    setAlistError(null);
    try {
      const res = await fetchAlist({ action: 'list', path });
      const data = await res.json();
      if (data.code === 200) {
        setAlistFiles(data.data?.content || []);
        setAlistPath(path);
        setAlistSelected(new Set());
      } else {
        setAlistError(data.message || '加载失败');
      }
    } catch { setAlistError('网盘接口异常'); }
    finally { setAlistLoading(false); }
  };
  // === 下载逻辑 ===
  const alistDirectDownload = (filePath: string, fileSign?: string) => {
    const url = fileSign ? `${getAlistBase()}/d${filePath}?sign=${fileSign}` : `${getAlistBase()}/d${filePath}`;
    window.open(url, '_blank');
  };

  const alistProxyDownload = (filePath: string, fileName: string) => {
    let downloadUrl = `/api/alist-download?path=${encodeURIComponent(filePath)}`;
    const ccConfigStr = localStorage.getItem('ALIST_CUSTOM_CONFIG');
    if (ccConfigStr) {
      downloadUrl += `&c=${btoa(encodeURIComponent(ccConfigStr))}`;
    }
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const alistNavigate = (item: any) => {
    if (item.is_dir) {
      const newPath = `${alistPath.replace(/\/+$/, '')}/${item.name}`;
      setAlistSelected(new Set());
      alistListDir(newPath);
    } else {
      const filePath = `${alistPath.replace(/\/+$/, '')}/${item.name}`;
      const isBaidu = alistPath.startsWith('/百度网盘') || alistPath.startsWith('/baidu');
      const isAliyun = alistPath.startsWith('/阿里云盘') || alistPath.startsWith('/aliyun') || alistPath.startsWith('/aliyun_new');
      if (isBaidu && (item.size || 0) >= SIZE_THRESHOLD) {
        setAlistDownloadModal({ name: item.name, filePath, sign: item.sign });
      } else if (isAliyun) {
        alistProxyDownload(filePath, item.name);
      } else {
        alistDirectDownload(filePath, item.sign);
      }
    }
  };

  const alistBatchDownload = () => {
    const isBaidu = alistPath.startsWith('/百度网盘') || alistPath.startsWith('/baidu');
    const isAliyun = alistPath.startsWith('/阿里云盘') || alistPath.startsWith('/aliyun') || alistPath.startsWith('/aliyun_new');
    alistSelected.forEach(name => {
      const file = alistFiles.find((f: any) => f.name === name);
      const filePath = `${alistPath.replace(/\/+$/, '')}/${name}`;
      if (isAliyun || (isBaidu && file && (file.size || 0) >= SIZE_THRESHOLD)) {
        alistProxyDownload(filePath, name);
      } else {
        alistDirectDownload(filePath, file?.sign);
      }
    });
    setAlistSelected(new Set());
  };

  const alistToggleSelect = (name: string) => {
    setAlistSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const alistSelectAll = () => {
    const fileNames = alistFiles.filter((f: any) => !f.is_dir).map((f: any) => f.name);
    if (alistSelected.size === fileNames.length) setAlistSelected(new Set());
    else setAlistSelected(new Set(fileNames));
  };

  // === 文件管理操作 ===
  const alistMkdir = async () => {
    if (!alistMkdirName.trim()) return;
    setAlistMsg(null);
    try {
      const res = await fetchAlist({ action: 'mkdir', path: alistPath, dir_name: alistMkdirName.trim() });
      const data = await res.json();
      if (data.code === 200) { setAlistMsg('✅ 文件夹创建成功'); setAlistMkdirName(''); setAlistShowMkdir(false); alistListDir(alistPath); }
      else setAlistMsg(`❌ ${data.message}`);
    } catch { setAlistMsg('❌ 接口异常'); }
  };

  const alistRemove = async (name: string) => {
    if (!confirm(`确认删除 ${name} 吗？`)) return;
    setAlistMsg(null);
    try {
      const res = await fetchAlist({ action: 'remove', path: alistPath, names: [name] });
      const data = await res.json();
      if (data.code === 200) { setAlistMsg('✅ 删除成功'); alistListDir(alistPath); }
      else setAlistMsg(`❌ ${data.message}`);
    } catch { setAlistMsg('❌ 接口异常'); }
  };

  const alistRename = async (filePath: string) => {
    if (!alistNewName.trim()) return;
    setAlistMsg(null);
    try {
      const res = await fetchAlist({ action: 'rename', path: filePath, newName: alistNewName.trim() });
      const data = await res.json();
      if (data.code === 200) { setAlistMsg('✅ 重命名成功'); setAlistRenaming(null); setAlistNewName(''); alistListDir(alistPath); }
      else setAlistMsg(`❌ ${data.message}`);
    } catch { setAlistMsg('❌ 接口异常'); }
  };

  const alistUpload = async () => {
    if (!alistUploadFile || !adminToken) return;
    setAlistUploading(true);
    setAlistMsg(null);
    try {
      const tokenRes = await fetch('/api/alist-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!tokenRes.ok) throw new Error('Cannot get AList token');
      const { token: alistToken } = await tokenRes.json();
      const uploadPath = alistPath.replace(/\/+$/, '') + '/' + alistUploadFile.name;
      const uploadRes = await fetch(`${getAlistBase()}/api/fs/put`, {
        method: 'PUT',
        headers: {
          'Authorization': alistToken,
          'File-Path': encodeURIComponent(uploadPath),
          'Content-Type': alistUploadFile.type || 'application/octet-stream',
          'Content-Length': String(alistUploadFile.size),
        },
        body: alistUploadFile,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.code === 200) { setAlistMsg('✅ 上传成功'); setAlistUploadFile(null); alistListDir(alistPath); }
      else setAlistMsg(`❌ ${uploadData.message}`);
    } catch (e: any) { setAlistMsg(`❌ 上传失败: ${e.message}`); }
    finally { setAlistUploading(false); }
  };

  // === 工具函数 ===
  const formatSize = (size: number) => {
    if (size >= 1073741824) return `${(size / 1073741824).toFixed(1)}GB`;
    if (size >= 1048576) return `${(size / 1048576).toFixed(1)}MB`;
    if (size >= 1024) return `${Math.round(size / 1024)}KB`;
    return `${size}B`;
  };

  const getFileIcon = (file: any) => {
    if (file.is_dir) return '📁';
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(file.name)) return '🖼️';
    if (/\.(mp4|mkv|avi|mov|webm)$/i.test(file.name)) return '🎬';
    if (/\.(mp3|flac|wav|ogg|aac)$/i.test(file.name)) return '🎵';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(file.name)) return '📦';
    if (/\.(pdf)$/i.test(file.name)) return '📕';
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(file.name)) return '📝';
    return '📄';
  };

  if (!mounted) return <div className="bg-[#050506] min-h-screen" />;
  // === 登录页 ===
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-[#050506] text-zinc-300 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-black/60 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">☁️</div>
            <h1 className="text-xl font-black text-white tracking-tight">AList 下载器</h1>
            <p className="text-[11px] text-zinc-600 mt-1">百度网盘 · 阿里云盘 · 多网盘聚合下载</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              placeholder="管理员密码"
              className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition-colors"
            />
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className={`w-full text-xs font-bold py-2.5 rounded-lg transition-all ${authLoading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-pink-500 text-white hover:bg-pink-400 hover:shadow-lg hover:shadow-pink-500/20'}`}
            >
              {authLoading ? '验证中...' : '登 录'}
            </button>
            {authError && <div className="text-[11px] text-red-400 text-center">{authError}</div>}
          </div>
        </div>
      </div>
    );
  }

  // === 主应用 ===
  return (
    <div className="min-h-screen bg-[#050506] text-zinc-300 font-mono flex flex-col selection:bg-pink-500/30">

      {/* 顶部状态栏 */}
      <header className="h-11 bg-[#0c0c0e] border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 text-[10px] font-bold tracking-widest text-zinc-500 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base">☁️</span>
          <span className="text-pink-400 uppercase">AList 下载器</span>
          <span className="opacity-30">|</span>
          <span className="text-emerald-500 hidden sm:inline">ONLINE</span>
        </div>
        <div className="flex items-center gap-3">
          {adminToken && (
            <button
              onClick={() => {
                const cc = getCustomConfig();
                if (cc) {
                  setCustomUrl(cc.url || '');
                  setCustomUser(cc.user || '');
                  setCustomPass(cc.pass || '');
                }
                setShowSettings(true);
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors tracking-widest flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              设置
            </button>
          )}
          <button onClick={handleLogout} className="text-[10px] text-zinc-500 hover:text-pink-400 transition-colors tracking-widest">
            LOGOUT
          </button>
        </div>
      </header>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm bg-[#0c0c0e] border border-zinc-700 rounded-2xl p-4 shadow-2xl mx-4 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[12px] text-white font-bold">⚙️ AList 服务端设置</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">仅在您当前浏览器有效，覆盖系统默认配置</div>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-zinc-600 hover:text-zinc-300 text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-400 mb-1 block">AList_URL [必须项]</label>
                <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="如: http://47.108.222.119:5244" className="w-full bg-black border border-zinc-800 rounded px-2.5 py-2 text-[11px] text-white outline-none focus:border-pink-500" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 mb-1 block">AList_Username [用于后台/直链获取]</label>
                <input type="text" value={customUser} onChange={e => setCustomUser(e.target.value)} placeholder="可留空使用默认" className="w-full bg-black border border-zinc-800 rounded px-2.5 py-2 text-[11px] text-white outline-none focus:border-pink-500" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 mb-1 block">AList_Password</label>
                <input type="password" value={customPass} onChange={e => setCustomPass(e.target.value)} placeholder="可留空使用默认" className="w-full bg-black border border-zinc-800 rounded px-2.5 py-2 text-[11px] text-white outline-none focus:border-pink-500" />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  if (customUrl) {
                    localStorage.setItem('ALIST_CUSTOM_CONFIG', JSON.stringify({ url: customUrl, user: customUser, pass: customPass }));
                    setAlistMsg('✅ 本地自定义配置已保存并生效');
                  } else {
                    localStorage.removeItem('ALIST_CUSTOM_CONFIG');
                    setAlistMsg('✅ 已恢复默认后端配置');
                  }
                  setShowSettings(false);
                  alistListDir('/'); // 重新加载根目录
                }}
                className="flex-1 bg-pink-500 text-white text-[11px] font-bold py-2 rounded shadow hover:bg-pink-400"
              >
                保存配置
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('ALIST_CUSTOM_CONFIG');
                  setCustomUrl(''); setCustomUser(''); setCustomPass('');
                  setAlistMsg('✅ 已恢复默认配置');
                  setShowSettings(false);
                  alistListDir('/');
                }}
                className="px-3 bg-zinc-800 text-zinc-300 text-[11px] py-2 rounded hover:bg-zinc-700"
              >
                恢复默认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 大文件下载方式选择弹窗 */}
      {alistDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setAlistDownloadModal(null)}>
          <div className="w-full max-w-sm bg-[#0c0c0e] border border-zinc-700 rounded-2xl p-4 shadow-2xl mx-4 glow-pink animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">大文件下载 ≥20MB</div>
                <div className="text-xs text-white font-mono truncate max-w-[260px] mt-1">{alistDownloadModal.name}</div>
              </div>
              <button onClick={() => setAlistDownloadModal(null)} className="text-zinc-600 hover:text-zinc-300 text-lg">✕</button>
            </div>
            <div className="space-y-2">
              {/* 自动加UA直接下载 */}
              <button
                onClick={() => {
                  let downloadUrl = `/api/alist-download?path=${encodeURIComponent(alistDownloadModal.filePath)}`;
                  const ccConfigStr = localStorage.getItem('ALIST_CUSTOM_CONFIG');
                  if (ccConfigStr) {
                    downloadUrl += `&c=${btoa(encodeURIComponent(ccConfigStr))}`;
                  }
                  window.open(downloadUrl, '_blank');
                  setAlistDownloadModal(null);
                }}
                className="w-full flex items-center justify-between bg-zinc-900 border border-pink-500/40 rounded-lg px-3 py-2.5 hover:border-pink-400 transition-colors text-left"
              >
                <div>
                  <div className="text-[11px] font-bold text-pink-400">🔥 直接下载（自动加 UA: pan.baidu.com）</div>
                  <div className="text-[10px] text-zinc-500">服务器自动添加 User-Agent 请求头，一键下载</div>
                </div>
              </button>

              {/* 复制直链 */}
              <button
                onClick={() => {
                  fetchAlist({ action: 'get', path: alistDownloadModal.filePath })
                    .then(r => r.json())
                    .then(data => {
                      const sign = data.code === 200 ? (data.data?.sign || '') : '';
                      const url = sign ? `${getAlistBase()}/d${alistDownloadModal!.filePath}?sign=${sign}` : `${getAlistBase()}/d${alistDownloadModal!.filePath}`;
                      navigator.clipboard.writeText(url);
                      setAlistMsg('✅ 直链已复制！粘贴到迅雷/IDM即可满速下载');
                    }).catch(() => {
                      navigator.clipboard.writeText(`${getAlistBase()}/d${alistDownloadModal!.filePath}`);
                      setAlistMsg('✅ 链接已复制');
                    });
                  setAlistDownloadModal(null);
                }}
                className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 hover:border-emerald-500/50 transition-colors text-left"
              >
                <div>
                  <div className="text-[11px] font-bold text-emerald-400">🚀 复制直链（迅雷/IDM）</div>
                  <div className="text-[10px] text-zinc-600">粘贴到下载工具，SVIP 满速</div>
                </div>
              </button>

              {/* Cloudflare Workers 边缘代理 */}
              <button
                onClick={() => {
                  fetchAlist({ action: 'get', path: alistDownloadModal!.filePath })
                    .then(r => r.json())
                    .then(data => {
                      if (data.code === 200 && data.data?.raw_url) {
                        const cfUrl = `https://cf.ryantan.fun/?url=${encodeURIComponent(data.data.raw_url)}`;
                        window.location.href = cfUrl;
                      } else {
                        setAlistMsg('❌ 获取直链失败，无法走 CF 代理');
                      }
                    }).catch(() => setAlistMsg('❌ 接口异常'));
                  setAlistDownloadModal(null);
                }}
                className="w-full flex items-center justify-between bg-zinc-900 border border-blue-500/30 rounded-lg px-3 py-2.5 hover:border-blue-400 transition-colors text-left"
              >
                <div>
                  <div className="text-[11px] font-bold text-blue-400">☁️ Cloudflare 边缘加速</div>
                  <div className="text-[10px] text-zinc-500">CF Worker 注入 UA，全球边缘节点中转，不耗服务器带宽</div>
                </div>
              </button>

              {/* ⚡ 302 直链 */}
              <button
                onClick={() => { alistDirectDownload(alistDownloadModal.filePath, alistDownloadModal.sign); setAlistDownloadModal(null); }}
                className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 hover:border-zinc-600 transition-colors text-left"
              >
                <div>
                  <div className="text-[11px] font-bold text-zinc-400">⚡ 302直链跳转（不加UA）</div>
                  <div className="text-[10px] text-zinc-600">直接跳转百度CDN，大文件可能被拦截</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto animate-in">

          {/* 更新日志弹窗 */}
          {showChangelog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowChangelog(false)}>
              <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-pink-500">📝</span>
                    <h3 className="text-sm font-bold text-zinc-200">更新日志 <span className="text-zinc-500 font-normal text-xs ml-1">Changelog</span></h3>
                  </div>
                  <button onClick={() => setShowChangelog(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="relative pl-4 border-l-2 border-pink-500/30">
                    <div className="absolute w-2 h-2 bg-pink-500 rounded-full left-[-5px] top-1.5 ring-4 ring-zinc-950"></div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-pink-400">v1.2.1</span>
                      <span className="text-[10px] text-zinc-500 font-mono">2026-02-28</span>
                    </div>
                    <ul className="text-[11px] text-zinc-400 space-y-1 list-disc pl-3 mt-1 marker:text-zinc-700">
                      <li>修复移动端浏览器拦截 CF 代理加速新窗口弹窗的问题，改为直接跳转下载。</li>
                      <li>添加了各端同步的版本号标识和详细的更新日志展示面板。</li>
                    </ul>
                  </div>

                  <div className="relative pl-4 border-l-2 border-zinc-800">
                    <div className="absolute w-2 h-2 bg-zinc-700 rounded-full left-[-5px] top-1.5 ring-4 ring-zinc-950"></div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-300">v1.2.0</span>
                      <span className="text-[10px] text-zinc-600 font-mono">2026-02-27</span>
                    </div>
                    <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-3 mt-1 marker:text-zinc-800">
                      <li>移除之前不稳定的多线程方案，整体逻辑退回至更快速稳定的经典直链防封代理模式。</li>
                      <li>恢复 4 个默认经典的下载触发模式挑选界面。</li>
                      <li>修复了大文件 302 直链下载以及批量下载时丢失 sign 参数导致 403 的阻断报错问题。</li>
                      <li>完成了纯享版本 baidu-pan-alist 到单独 Github 全栈库的抽离和同步独立部署。</li>
                      <li>增加部署了基于 Supabase 的全站流量与精准地域维度分发的后端统计与 API 埋点。</li>
                    </ul>
                  </div>

                  <div className="relative pl-4 border-l-2 border-zinc-800">
                    <div className="absolute w-2 h-2 bg-zinc-700 rounded-full left-[-5px] top-1.5 ring-4 ring-zinc-950"></div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-300">v1.1.0</span>
                      <span className="text-[10px] text-zinc-600 font-mono">2026-02-26</span>
                    </div>
                    <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-3 mt-1 marker:text-zinc-800">
                      <li>新增 Cloudflare Workers 边缘代理加速下载选项，拯救本地屏蔽的大容量压缩包等文件。</li>
                      <li>针对移动端的各种极端误触与样式自适应问题做了专门优化与适配。</li>
                      <li>针对跨网盘（阿里云盘等）增加了原生 AList /p/ 智能服务端代理下载，彻底修复签名缺失报错。</li>
                    </ul>
                  </div>

                  <div className="relative pl-4 border-l-2 border-zinc-800">
                    <div className="absolute w-2 h-2 bg-zinc-700 rounded-full left-[-5px] top-1.5 ring-4 ring-zinc-950"></div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-300">v1.0.0</span>
                      <span className="text-[10px] text-zinc-600 font-mono">2026-02-25</span>
                    </div>
                    <ul className="text-[11px] text-zinc-500 space-y-1 list-disc pl-3 mt-1 marker:text-zinc-800">
                      <li>初始提交开源项目主线框架：在 Dashboard 控制台核心区域嵌入百度网盘· AList 的深度集成文件流体系。</li>
                      <li>原生拥有一站式的系统资源独立文件分类视图、新建、极速重命名、实时全选与批处理下载机制。</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 文件浏览器卡片 */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">

            {/* 头部工具栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black/40">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase italic text-zinc-500">Cloud_Drive</span>
                <span className="text-[10px] text-zinc-600">· AList</span>
                <button
                  onClick={() => setShowChangelog(true)}
                  className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-pink-400 hover:bg-zinc-700 transition-colors cursor-pointer border border-pink-500/20"
                  title="查看更新日志"
                >
                  v1.2.1
                </button>
              </div>
              <div className="flex items-center gap-2">
                {adminToken && (
                  <>
                    <button onClick={() => setAlistShowMkdir(!alistShowMkdir)}
                      className="text-[10px] text-zinc-500 hover:text-pink-400 transition-colors px-2 py-1 border border-zinc-800 rounded" title="新建文件夹">
                      + 文件夹
                    </button>
                    <label className="text-[10px] text-zinc-500 hover:text-pink-400 transition-colors px-2 py-1 border border-zinc-800 rounded cursor-pointer" title="上传文件">
                      {alistUploading ? '上传中...' : '↑ 上传'}
                      <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAlistUploadFile(f); }} />
                    </label>
                  </>
                )}
                <button onClick={() => alistListDir(alistPath)} className="text-zinc-600 hover:text-pink-400 transition-colors" title="刷新">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* 面包屑导航 */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800/50 overflow-x-auto">
              {alistPath.split('/').filter(Boolean).length === 0 ? (
                <span className="text-pink-400 text-[11px] font-mono font-bold">/ Root</span>
              ) : (
                ['', ...alistPath.split('/').filter(Boolean)].map((seg, idx, arr) => {
                  const crumbPath = '/' + arr.slice(1, idx + 1).join('/');
                  return (
                    <span key={idx} className="flex items-center gap-1">
                      {idx > 0 && <span className="text-zinc-700">/</span>}
                      <button
                        onClick={() => alistListDir(idx === 0 ? '/' : crumbPath)}
                        className={`text-[11px] font-mono hover:text-pink-400 transition-colors whitespace-nowrap ${idx === arr.length - 1 ? 'text-white font-bold' : 'text-zinc-500'}`}
                      >
                        {idx === 0 ? 'Root' : seg}
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {/* 新建文件夹 */}
            {alistShowMkdir && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/60">
                <input value={alistMkdirName} onChange={e => setAlistMkdirName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && alistMkdir()}
                  placeholder="新建文件夹名称..." autoFocus
                  className="flex-1 bg-black/40 border border-zinc-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-pink-500 transition-colors" />
                <button onClick={alistMkdir} className="px-2 py-1 text-[10px] bg-pink-500 text-white rounded font-bold hover:bg-pink-400">创建</button>
                <button onClick={() => { setAlistShowMkdir(false); setAlistMkdirName(''); }} className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300">取消</button>
              </div>
            )}

            {/* 待上传确认 */}
            {alistUploadFile && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/60">
                <span className="text-[11px] text-zinc-400 flex-1 truncate">📎 {alistUploadFile.name}</span>
                <button onClick={alistUpload} disabled={alistUploading} className="px-2 py-1 text-[10px] bg-pink-500 text-white rounded font-bold hover:bg-pink-400 disabled:opacity-50">
                  {alistUploading ? '上传中...' : '确认上传'}
                </button>
                <button onClick={() => setAlistUploadFile(null)} className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300">取消</button>
              </div>
            )}

            {/* 消息提示 */}
            {alistMsg && (
              <div className={`px-4 py-1.5 text-[11px] font-bold border-b border-zinc-800/50 ${alistMsg.startsWith('✅') ? 'text-green-400 bg-green-500/5' : alistMsg.startsWith('🚀') ? 'text-blue-400 bg-blue-500/5' : 'text-yellow-400 bg-yellow-500/5'}`}>
                {alistMsg}
              </div>
            )}


            {/* 文件列表 */}
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {alistLoading ? (
                <div className="space-y-1 p-4">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-9 skeleton rounded" />)}
                </div>
              ) : alistError ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <span className="text-red-400 text-[11px]">{alistError}</span>
                  <button onClick={() => alistListDir(alistPath)} className="text-[10px] text-zinc-500 hover:text-pink-400 border border-zinc-700 px-2 py-1 rounded">重试</button>
                </div>
              ) : alistFiles.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-zinc-600 text-xs">📭 空目录</div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {/* 返回上级 */}
                  {alistPath !== '/' && (
                    <button
                      onClick={() => { const parent = alistPath.replace(/\/[^/]+\/?$/, '') || '/'; alistListDir(parent); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/60 transition-colors text-left"
                    >
                      <span className="text-base">⬆️</span>
                      <span className="text-[11px] text-zinc-500 font-mono">..</span>
                    </button>
                  )}

                  {alistFiles.map((file: any, idx: number) => {
                    const filePath = `${alistPath.replace(/\/+$/, '')}/${file.name}`;
                    return (
                      <div key={idx} className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800/40 transition-colors group">
                        {/* 复选框 */}
                        {!file.is_dir ? (
                          <input type="checkbox" checked={alistSelected.has(file.name)} onChange={() => alistToggleSelect(file.name)}
                            className="w-3 h-3 accent-pink-500 shrink-0 cursor-pointer" />
                        ) : <span className="w-3 shrink-0" />}

                        {/* 图标 */}
                        <span className="text-base shrink-0">{getFileIcon(file)}</span>

                        {/* 重命名 */}
                        {alistRenaming === filePath ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input value={alistNewName} onChange={e => setAlistNewName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') alistRename(filePath); if (e.key === 'Escape') setAlistRenaming(null); }}
                              className="flex-1 bg-black/60 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-white outline-none focus:border-pink-500" autoFocus />
                            <button onClick={() => alistRename(filePath)} className="text-[10px] text-pink-400 font-bold hover:text-pink-300">✓</button>
                            <button onClick={() => setAlistRenaming(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300">✕</button>
                          </div>
                        ) : (
                          <>
                            {/* 文件名 */}
                            <button onClick={() => alistNavigate(file)}
                              className="flex-1 text-left text-[11px] font-mono text-zinc-300 hover:text-pink-400 transition-colors truncate">
                              {file.name}
                            </button>

                            {/* 文件大小 */}
                            {!file.is_dir && (
                              <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:block">
                                {formatSize(file.size || 0)}
                              </span>
                            )}

                            {/* 修改时间 */}
                            <span className="text-[10px] text-zinc-700 shrink-0 hidden md:block">
                              {file.modified ? new Date(file.modified).toLocaleDateString() : ''}
                            </span>

                            {/* 管理操作 */}
                            {adminToken && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => { setAlistRenaming(filePath); setAlistNewName(file.name); }}
                                  className="text-zinc-600 hover:text-blue-400 transition-colors p-0.5" title="重命名">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => alistRemove(file.name)}
                                  className="text-zinc-600 hover:text-red-500 transition-colors p-0.5" title="删除">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 底部状态栏 */}
            <div className="px-4 py-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-600 bg-black/20">
              <div className="flex items-center gap-3">
                <button onClick={alistSelectAll} className="hover:text-pink-400 transition-colors">
                  {alistSelected.size > 0 ? `☑ ${alistSelected.size} 个文件` : `${alistFiles.length} 个项目`}
                </button>
                {alistSelected.size > 0 && (
                  <button onClick={alistBatchDownload} className="text-[10px] text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1">
                    ↓ 批量下载
                  </button>
                )}
              </div>
              <button onClick={() => window.open(getAlistBase(), '_blank')} className="hover:text-pink-400 transition-colors">
                在 AList 中打开 ↗
              </button>
            </div>

          </div>
        </div>
      </main>
    </div >
  );
}
