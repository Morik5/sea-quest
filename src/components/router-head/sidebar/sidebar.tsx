
import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import './sidebar.css'

export const Sidebar = component$(() => {
    
    

    return (
        <>
            {/* Desktop Sidebar */}
            <nav class="sidebar desktop-only">
                <div class="bubble-menu">
                    <Link href="/practice" class="bubble left" data-text="procvičování">Cvičení</Link>
                    <Link href="/leaderboard" class="bubble right" data-text="žebříček">Žebříček</Link>
                    <Link href="/my-classrooms" class="bubble left" data-text="classroom">Třídy</Link>
                    <Link href="/achievements" class="bubble right" data-text="achievementy">Ocenění</Link>
                    <Link href="/profile" class="bubble left" data-text="profil">Profil</Link>
                </div>
            </nav>
            
            {/* Mobile Bottom Navigation */}
            <nav class="mobile-nav mobile-only">
                <Link href="/practice" class="mobile-nav-item">
                    <span class="mobile-nav-icon">📝</span>
                    <span class="mobile-nav-label">Cvičení</span>
                </Link>
                <Link href="/leaderboard" class="mobile-nav-item">
                    <span class="mobile-nav-icon">🏆</span>
                    <span class="mobile-nav-label">Žebříček</span>
                </Link>
                <Link href="/my-classrooms" class="mobile-nav-item">
                    <span class="mobile-nav-icon">👨‍👩‍👧‍👦</span>
                    <span class="mobile-nav-label">Třídy</span>
                </Link>
                <Link href="/achievements" class="mobile-nav-item">
                    <span class="mobile-nav-icon">🎖️</span>
                    <span class="mobile-nav-label">Ocenění</span>
                </Link>
                <Link href="/profile" class="mobile-nav-item">
                    <span class="mobile-nav-icon">👤</span>
                    <span class="mobile-nav-label">Profil</span>
                </Link>
            </nav>
        </>
    );
});