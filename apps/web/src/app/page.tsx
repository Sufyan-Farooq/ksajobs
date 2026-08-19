import React from 'react';
import HeroSearch from '../components/HeroSearch';
import FilterSidebar from '../components/FilterSidebar';
import JobCard from '../components/JobCard';
import { jobRepository } from '@ksajobs/database';
import { Briefcase, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    saudization?: string;
    workType?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);

  let jobs: any[] = [];
  let totalJobs = 0;
  let totalPages = 1;

  try {
    const result = await jobRepository.findPublishedJobs({
      searchQuery: params.q,
      city: params.city,
      saudization: params.saudization,
      workType: params.workType,
      category: params.category,
      page,
      limit: 15,
    });

    jobs = result.items;
    totalJobs = result.total;
    totalPages = result.totalPages;
  } catch (err) {
    jobs = [];
    totalJobs = 0;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner with Search */}
      <HeroSearch />

      {/* Main Grid: Filters + Job Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <FilterSidebar />
        </div>

        {/* Job Listings Column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>Available Career Opportunities</span>
              <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                {totalJobs} {totalJobs === 1 ? 'Job' : 'Jobs'}
              </span>
            </div>
          </div>

          {/* Jobs Feed */}
          {jobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No active job listings found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The database is currently fresh. Start the scraper worker (`pnpm dev:bot`) to begin ingesting and moderating new KSA job listings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/?page=${p}`}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                    page === p
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
