import {useEffect,useState} from "react";
import MatchHistoryCard from "../../components/ui/MatchHistoryCard";
import SectionHeading from "../../components/ui/SectionHeading";

function getCalendarDays(year,month){
  const firstDay=new Date(year,month-1,1).getDay();
  const daysInMonth=new Date(year,month,0).getDate();
  const days=[];
  for(let i=0;i<firstDay;i+=1) days.push(null);
  for(let day=1;day<=daysInMonth;day+=1) days.push(day);
  return days;
}

function monthName(month){
  return new Date(2026,month-1,1).toLocaleString(undefined,{month:"long"});
}

export default function Calendar({apiUrl,canEdit,onOpen,onEdit,onDelete,refreshKey}){
  const today=new Date();
  const [calendarMonth,setCalendarMonth]=useState(today.getMonth()+1);
  const [calendarYear,setCalendarYear]=useState(today.getFullYear());
  const [calendarMatches,setCalendarMatches]=useState([]);
  const [calendarLoading,setCalendarLoading]=useState(false);
  const [hoveredDay,setHoveredDay]=useState(null);
  const [selectedDay,setSelectedDay]=useState(today.getDate());

  useEffect(()=>{
    let cancelled=false;
    async function loadCalendar(){
      try{
        setCalendarLoading(true);
        const response=await fetch(`${apiUrl}/stats/calendar?year=${calendarYear}&month=${calendarMonth}`);
        if(!response.ok) throw new Error("Could not load calendar.");
        const data=await response.json();
        if(!cancelled) setCalendarMatches(Array.isArray(data.matches)?data.matches:[]);
      }catch(error){
        console.error(error);
        if(!cancelled) setCalendarMatches([]);
      }finally{
        if(!cancelled) setCalendarLoading(false);
      }
    }
    loadCalendar();
    return()=>{cancelled=true;};
  },[apiUrl,calendarYear,calendarMonth,refreshKey]);

  function matchesForDay(day){
    if(!day) return [];
    return calendarMatches.filter(match=>{
      const value=new Date(match.date);
      return value.getFullYear()===calendarYear&&value.getMonth()+1===calendarMonth&&value.getDate()===day;
    });
  }

  function previousMonth(){
    setSelectedDay(null);
    if(calendarMonth===1){
      setCalendarMonth(12);
      setCalendarYear(year=>year-1);
    }else{
      setCalendarMonth(month=>month-1);
    }
  }

  function nextMonth(){
    setSelectedDay(null);
    if(calendarMonth===12){
      setCalendarMonth(1);
      setCalendarYear(year=>year+1);
    }else{
      setCalendarMonth(month=>month+1);
    }
  }

  return (
    <section className="tab-content">
      <div className="page-title">
        <p className="eyebrow">MATCH JOURNAL</p>
        <h2>Calendar</h2>
        <p>Browse Matchday history day by day.</p>
      </div>

      <section className="card calendar-card">
        <div className="calendar-header">
          <button type="button" className="calendar-nav" onClick={previousMonth}>‹</button>
          <div>
            <h3>{monthName(calendarMonth)} {calendarYear}</h3>
            <span>{calendarMatches.length} matches</span>
          </div>
          <button type="button" className="calendar-nav" onClick={nextMonth}>›</button>
        </div>

        {calendarLoading ? (
          <div className="loading-panel">Loading calendar...</div>
        ) : (
          <>
            <div className="calendar-weekdays">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className="calendar-grid">
              {getCalendarDays(calendarYear,calendarMonth).map((day,index)=>{
                const dayMatches=matchesForDay(day);
                return (
                  <button
                    key={`${calendarYear}-${calendarMonth}-${index}`}
                    type="button"
                    disabled={!day}
                    className={`calendar-day ${dayMatches.length?"has-match":""} ${selectedDay===day?"selected-day":""}`}
                    onMouseEnter={()=>setHoveredDay(day)}
                    onMouseLeave={()=>setHoveredDay(null)}
                    onClick={()=>setSelectedDay(day)}
                  >
                    {day&&(
                      <>
                        <strong>{day}</strong>
                        {dayMatches.length>0&&<span className="calendar-dot"/>}
                        {hoveredDay===day&&dayMatches.length>0&&(
                          <div className="calendar-popover">
                            {dayMatches.map(match=>(
                              <div key={match._id}>
                                <strong>{match.teamA?.score} : {match.teamB?.score}</strong>
                                <span>{match.teamA?.label} vs {match.teamB?.label}</span>
                                <small>{match.name}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="section-block">
        <SectionHeading
          eyebrow="DAY DETAILS"
          title={selectedDay?(`${monthName(calendarMonth)} ${selectedDay}`):"Select a date"}
        />

        {selectedDay&&matchesForDay(selectedDay).length>0?(
          <div className="match-list">
            {matchesForDay(selectedDay).map(match=>(
              <MatchHistoryCard
                onOpen={()=>onOpen(match._id)}
                key={match._id}
                match={match}
                canEdit={canEdit}
                onEdit={()=>onEdit(match)}
                onDelete={()=>onDelete(match._id)}
              />
            ))}
          </div>
        ):(
          <div className="empty-state">
            <span>📅</span>
            <h3>No matches this day</h3>
            <p>Select another date to explore the archive.</p>
          </div>
        )}
      </section>
    </section>
  );
}
