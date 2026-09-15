import { useState } from 'react';
import { AppBar, Toolbar, Container, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar, Menu, MenuItem, Divider, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StarIcon from '@mui/icons-material/StarBorder';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, setUser } from '../../store';
import api, { clearSession, REFRESH_KEY } from '../../services/api';
import { LanguagePicker, Logo } from './PublicLayout';

export default function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const items = [
    { to: '/dashboard', label: t('dashboard'), icon: <DashboardIcon /> },
    { to: '/documents', label: t('myDocuments'), icon: <LibraryBooksIcon /> },
    { to: '/favorites', label: t('favorites'), icon: <StarIcon /> },
    { to: '/templates', label: t('templates'), icon: <LibraryBooksIcon /> },
    { to: '/audit', label: t('audit'), icon: <HistoryIcon /> },
    { to: '/profile', label: t('profile'), icon: <PersonIcon /> },
  ];
  const adminItems = [
    { to: '/admin', label: `${t('admin')} · Stats`, icon: <AdminPanelSettingsIcon /> },
    { to: '/admin/templates', label: 'Templates Studio', icon: <LibraryBooksIcon /> },
    { to: '/admin/users', label: 'Users', icon: <PersonIcon /> },
    { to: '/admin/audit', label: 'System Audit', icon: <HistoryIcon /> },
  ];

  const logout = async (): Promise<void> => {
    try { await api.post('/auth/logout', { refreshToken: localStorage.getItem(REFRESH_KEY) }); } catch { /* ignore */ }
    clearSession();
    dispatch(setUser(null));
    navigate('/');
  };

  const navList = (
    <List sx={{ px: 1.5 }} onClick={() => setOpen(false)}>
      {items.map((it) => (
        <ListItemButton key={it.to} selected={location.pathname.startsWith(it.to)} onClick={() => navigate(it.to)} sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.dark' } }}>
          <ListItemIcon sx={{ minWidth: 40 }}>{it.icon}</ListItemIcon>
          <ListItemText primary={it.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
        </ListItemButton>
      ))}
      {user?.role === 'admin' && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 700 }}>ADMIN</Typography>
          {adminItems.map((it) => (
            <ListItemButton key={it.to} selected={location.pathname === it.to} onClick={() => navigate(it.to)} sx={{ borderRadius: 2, mb: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>{it.icon}</ListItemIcon>
              <ListItemText primary={it.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
            </ListItemButton>
          ))}
        </>
      )}
    </List>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={0} color="inherit"
        sx={{ top: 0, zIndex: 1100, borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <Toolbar disableGutters sx={{ gap: 1.5, px: { xs: 2, md: 3 }, minHeight: 64 }}>
          <IconButton onClick={() => setOpen(true)} sx={{ display: { md: 'none' } }}><MenuIcon /></IconButton>
          <Logo />
          <Box sx={{ flex: 1 }} />
          <LanguagePicker />
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15 }}>{(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}</Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography fontWeight={700}>{user?.fullName}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchor(null); navigate('/profile'); }}>{t('profile')}</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); navigate('/dashboard'); }}>{t('dashboard')}</MenuItem>
            <MenuItem onClick={logout} sx={{ color: 'error.main' }}><LogoutIcon fontSize="small" sx={{ mr: 1 }} />{t('logout')}</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: 264 } }}>
          {navList}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: 264, flexShrink: 0, '& .MuiDrawer-paper': { width: 264, borderRight: '1px solid #E5E7EB', position: 'relative', height: 'calc(100vh - 64px)' } }}>
          {navList}
        </Drawer>
        <Box component="main" key={location.key} className="route-fade" sx={{ flex: 1, p: { xs: 2, md: 3.5 }, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
