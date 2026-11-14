import { useMemo } from 'react';
import { useMeetingStore } from '../state/meetingStore';
import { useWorldStore } from '../state/worldStore';

export function useMeeting() {
  const meetings = useWorldStore((s) => s.meetings);
  const activeMeeting = useWorldStore((s) => s.activeMeeting);
  const activePresentation = useWorldStore((s) => s.activePresentation);
  const triggerBoardroomMeeting = useWorldStore((s) => s.triggerBoardroomMeeting);

  const splitViewOpen = useMeetingStore((s) => s.splitViewOpen);
  const observationPaused = useMeetingStore((s) => s.observationPaused);
  const expandedPresentation = useMeetingStore((s) => s.expandedPresentation);
  const selectedMeetingId = useMeetingStore((s) => s.selectedMeetingId);
  const setSplitViewOpen = useMeetingStore((s) => s.setSplitViewOpen);
  const setObservationPaused = useMeetingStore((s) => s.setObservationPaused);
  const setExpandedPresentation = useMeetingStore((s) => s.setExpandedPresentation);
  const setSelectedMeetingId = useMeetingStore((s) => s.setSelectedMeetingId);

  const currentMeeting = useMemo(() => {
    if (selectedMeetingId) {
      return meetings.find((m) => m.id === selectedMeetingId) || activeMeeting || meetings[0] || null;
    }
    return activeMeeting || meetings[0] || null;
  }, [meetings, activeMeeting, selectedMeetingId]);

  const isMeetingLive = useMemo(
    () => Boolean(activeMeeting && ['GATHERING', 'ACTIVE', 'PRESENTING'].includes(activeMeeting.status)),
    [activeMeeting]
  );

  return {
    meetings,
    activeMeeting,
    currentMeeting,
    activePresentation,
    isMeetingLive,
    splitViewOpen,
    observationPaused,
    expandedPresentation,
    setSplitViewOpen,
    setObservationPaused,
    setExpandedPresentation,
    setSelectedMeetingId,
    triggerBoardroomMeeting,
  };
}
