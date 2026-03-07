"use client";
import { useState, useEffect, useRef } from 'react';

const ALIST_BASE_DEFAULT = (process.env.NEXT_PUBLIC_ALIST_URL || 'http://47.108.222.119:5244').replace(/\/+$/, '');
const SIZE_THRESHOLD = 20 * 1024 * 1024; // 20MB

const CHANGELOG_DATA: { commit: string; date: string; message: string; version: string; isMilestone?: boolean }[] = [
  { commit: '82bbc8e', date: '2026-02-28', version: 'v1.3.0', isMilestone: true, message: '系统：更新跨项目的全栈数据大盘，完善并统合系统变更记录的时间轴组件。' },
  { commit: '2987c0c', date: '2026-02-28', version: 'v1.2.9', message: '系统：全面集成 v1.0 到 v1.2 的各项演变记录，在面板顶层增加版本控制徽章。' },
  { commit: 'f4af374', date: '2026-02-28', version: 'v1.2.8', message: '界面：注入系统版本号状态实时展示，并添加了全新的聚合更新日志弹出视窗交互。' },
  { commit: 'b88cd25', date: '2026-02-28', version: 'v1.2.7', isMilestone: true, message: '修复：优化并重构跳转机制，彻底解决了移动端浏览器拦截 Cloudflare 下载页代理弹窗的问题。' },
  { commit: '0db06b6', date: '2026-02-27', version: 'v1.2.6', isMilestone: true, message: '修复：填补高危遗漏，由于缺失 sign 参数导致部分直链下载抛出 403 阻断拒绝请求修复。' },
  { commit: '5a9ff26', date: '2026-02-27', version: 'v1.2.5', message: '系统：战略性放弃暂不稳定的 Web-NDM 引擎试验，全面回滚至兼容性最强的经典直链代理分发模式。' },
  { commit: 'b425416', date: '2026-02-26', version: 'v1.2.4', message: '网盘：针对小体积请求进行特判防 403 路由疏浚；在 Web NDM 中新增加速中断取消按钮。' },
  { commit: '276f54c', date: '2026-02-26', version: 'v1.2.3', message: '修复：规避 Cloudflare 代理节点缺失 Range 头缓存响应带来的底层文件大小检测受限 Bug。' },
  { commit: 'a161677', date: '2026-02-26', version: 'v1.2.2', message: '网络：加入突发流量重连并发策略，以强制手段打通部分地区针对多并发的分流掐断制裁。' },
  { commit: 'd5a9091', date: '2026-02-26', version: 'v1.2.1', message: '底层：撤回 Web NDM 的 IO 到盘缓存机制，改回全速无限制内存汇流传输；修复线程配置面板传值的 Bug。' },
  { commit: 'bbbbc7a', date: '2026-02-26', version: 'v1.2.0', message: '界面：提供高度开放配置，将底层的多线程数量参数通过滑块接口彻底放权给管理员自由调整。' },
  { commit: '1e475b0', date: '2026-02-26', version: 'v1.1.9', message: '修复：修补部分数据块龟速拖慢全图局面的隐患，为了减缓内存压力强转回磁盘模式，精简至3线程容错。' },
  { commit: 'ceee006', date: '2026-02-26', version: 'v1.1.8', isMilestone: true, message: '界面：进一步革新全站的多线程响应式操作视图布局，解决手机端直连状态下操作堆叠问题。' },
  { commit: '405d446', date: '2026-02-26', version: 'v1.1.7', message: '安全：加入针对 AList 专属主机的自由环境热切换以及服务器管理权限功能。' },
  { commit: '54b683a', date: '2026-02-26', version: 'v1.1.6', message: '网盘：加入一个备选的保守派单线程请求后备下载通道，保证环境极其恶劣下的下限。' },
  { commit: 'ce97770', date: '2026-02-26', version: 'v1.1.5', message: '系统：在核心 Dashboard 画廊总控中嵌入百度网盘专用的强力型多线程并发控制系统部件。' },
  { commit: '4ea312d', date: '2026-02-26', version: 'v1.1.4', message: '核心：自主研发并初现多线程 Web NDM 黑客级下载器逻辑构建框架。' },
  { commit: 'bf928dd', date: '2026-02-26', version: 'v1.1.3', isMilestone: true, message: '修复：绕过一切系统弹窗拦截机制——在触发 Cloudflare 无头浏览前以预生成标签页占据视图制高点。' },
  { commit: '573f68a', date: '2026-02-26', version: 'v1.1.2', message: '网盘：纠正阿里云等服务商走原载直连引发的签名劫持拦截报错，强行引流至原生独立 /p/ 代理引擎。' },
  { commit: 'd7f5968', date: '2026-02-26', version: 'v1.1.1', message: '网盘：修补对特供版 /aliyun_new 高级代理路由的动态探测抓取识别能力。' },
  { commit: '8899a17', date: '2026-02-26', version: 'v1.1.0', isMilestone: true, message: '核心：突围跨域死锁！成功使用经过后台鉴权签名并二次包裹头的服务端特种解析转发手段进行免限速投递。' },
  { commit: 'df597f5', date: '2026-02-26', version: 'v1.0.9', message: '网络：重构决策分发枢纽，其他通用网格走绿通直链，唯遇到极大参数量文件时触发调度器窗口。' },
  { commit: 'b022dba', date: '2026-02-26', version: 'v1.0.8', message: '网络：因基础 Workers.dev 域名大面积超时，全面更换主力加速通道至稳定定制域名 cf.ryantan.fun。' },
  { commit: '68766af', date: '2026-02-26', version: 'v1.0.7', message: '网络：惊艳亮相——首度嵌入全球泛播 Cloudflare Workers 边缘计算节点，真正实现无痛代理。' },
  { commit: '54ab4ba', date: '2026-02-26', version: 'v1.0.6', message: '核心：服务端强制染色，智能注入泛解析 pan.baidu.com 标的 User-Agent 防封锁识别机制。' },
  { commit: '1898d0a', date: '2026-02-26', version: 'v1.0.5', isMilestone: true, message: '试验：首发基于 HTML5 引擎的极快 32 原生并发切分下载实验室特性架构测试。' },
  { commit: '9505da3', date: '2026-02-25', version: 'v1.0.4', message: '功能：实装动态体量路由探测针，小对象一键下达直连，大质量文件呼出智能对策包窗口。' },
  { commit: '0214efa', date: '2026-02-25', version: 'v1.0.3', isMilestone: true, message: '系统：在首页搭建可视化地域流量分析监控屏；补全批量下载与勾选全选控件全家桶。' },
  { commit: '7c8068e', date: '2026-02-25', version: 'v1.0.2', message: '界面：精锐减负！移除历史死代码陈旧弹窗资产，并消灭所有 TypeScript 严格类型推导错误。' },
  { commit: 'a3a5e98', date: '2026-02-25', version: 'v1.0.2', message: '网络：免浏览器附加组件——以无头后端特异形态构建原生代理响应 UA 桥接。' },
  { commit: 'b6cfcd1', date: '2026-02-25', version: 'v1.0.1', message: '界面：扩建网盘下载面板选项体系，使直链极速通道与高隐匿代理信道并存。' },
  { commit: 'ba9c6a6', date: '2026-02-25', version: 'v1.0.1', message: '修复：阻截官方安全拦截锁，将大流量文件强制导流至纯净安全的 /p/ AList 隐身域控代理模式。' },
  { commit: '62e3f5e', date: '2026-02-25', version: 'v1.0.1', message: '网盘：规避严密封锁圈，灵活运用 /d/ 标准授权 URL 完成合法突破重定向桥梁架设。' },
  { commit: '584207f', date: '2026-02-25', version: 'v1.0.1', isMilestone: true, message: '集成：从 0 到 1 飞越：正式将强大的百度网盘· AList 集成中枢深度打散并入主控制台数据大屏内置独立工作组件内。' },
  { commit: '86655b8', date: '2026-02-25', version: 'v1.0.0', message: '修复：开放线上最高权限，允许 Vercel 生产强控环境下依然能直插终端调配后端 SQL 桥。' },
  { commit: '9c26c0b', date: '2026-02-25', version: 'v1.0.0', message: '修复：绕过远端跨域隔离，授予核心引擎针对生产主机的强制作出代码 GitHub Commit 变动的生杀大权。' },
  { commit: '25ea2a6', date: '2026-02-25', version: 'v1.0.0', message: '网络：极致压缩 GitHub API 底层管道交互指令，完美吞吐二进位流巨无霸大文件。' },
  { commit: '5559d8f', date: '2026-02-25', version: 'v1.0.0', message: '界面：彻底实施多端自适应手术改造计划，完成全屏幕宽度的弹性兼容与布局翻新。' },
  { commit: '5d69123', date: '2026-02-25', version: 'v1.0.0', message: '配置：注入 PostCSS 与 ESLint 基座守护底层框架样式生成稳定性。' },
  { commit: '378d1be', date: '2026-02-25', version: 'v1.0.0', message: '系统：基石竣工，包含样式库、安全鉴权密钥库、图标与部署映射图正式拼装入网。' },
  { commit: '46d1068', date: '2026-02-25', version: 'v1.0.0', isMilestone: true, message: '肇始：向浩瀚开源世界刻下包含 Vercel 域名解析、GitHub 代码推送及 Supabase SQL 阵列大盘的初代原型控制枢纽。' },
];

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
      const uploadPath = alistPath.replace(/\/+$/, '') + '/' + alistUploadFile.name;
      // 需要对每一段路径进行独立 URI 编码，避免 / 也被转义导致找不到目录
      const encodedFilePath = uploadPath.split('/').map(encodeURIComponent).join('/');

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${adminToken}`,
        'File-Path': encodedFilePath,
        'Content-Type': alistUploadFile.type || 'application/octet-stream',
        'Content-Length': String(alistUploadFile.size),
      };

      const cc = getCustomConfig();
      if (cc) {
        if (cc.url) headers['x-alist-url'] = cc.url;
        if (cc.user) headers['x-alist-username'] = cc.user;
        if (cc.pass) headers['x-alist-password'] = cc.pass;
      }

      const uploadRes = await fetch('/api/alist-upload', {
        method: 'PUT',
        headers,
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

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-6">
                  <div className="space-y-3">
                    {CHANGELOG_DATA.map((log, index) => {
                      if (log.isMilestone) {
                        return (
                          <div key={log.commit + index} className="relative pl-5 border-l-2 border-pink-500/40 py-2 mt-4 first:mt-0">
                            <div className="absolute w-2.5 h-2.5 bg-pink-500 rounded-full left-[calc(-0.4rem)] top-3 ring-4 ring-zinc-950 shadow-[0_0_8px_rgba(236,72,153,0.8)]"></div>
                            <div className="flex items-end gap-2 mb-1.5 pt-0.5">
                              <span className="text-sm font-black text-pink-400 tracking-wide">{log.version}</span>
                              <span className="text-[10px] bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-zinc-500">{log.commit}</span>
                              <span className="text-[10px] text-zinc-600 font-mono mb-[1px]">{log.date}</span>
                            </div>
                            <div className="text-[12px] text-zinc-300 font-medium mb-1 line-clamp-2 pr-2 leading-relaxed">
                              {log.message}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={log.commit + index} className="relative pl-5 border-l-2 border-zinc-800/80 py-1.5">
                          <div className="absolute w-1.5 h-1.5 bg-zinc-700 rounded-full left-[calc(-0.25rem)] top-2.5 ring-2 ring-zinc-950"></div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-zinc-400">{log.version}</span>
                            <span className="text-[9px] text-zinc-500 font-mono">{log.commit}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">{log.date}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 leading-tight pr-2">
                            {log.message}
                          </div>
                        </div>
                      );
                    })}
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
                  className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-pink-500/40 text-pink-400 hover:bg-zinc-800 hover:border-pink-300 transition-colors shadow-lg cursor-pointer"
                  title="查看更新日志"
                >
                  v1.3.0 ✨
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
