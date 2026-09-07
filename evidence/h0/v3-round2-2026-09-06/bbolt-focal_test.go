package bolt
import("testing";"fmt";"strings")
func TestFocalPut(t *testing.T) {
 for _,x:=range []struct{name,old,new string;page pgid;want string}{
  {"valid","a","a",0,""},{"old-empty","","a",0,"zero-length old key"},{"new-empty","a","",0,"zero-length new key"},{"page-boundary","a","a",1,"above high water mark"},
 } {t.Run(x.name,func(t *testing.T){
  n:=&node{inodes:make(inodes,0),bucket:&Bucket{tx:&Tx{meta:&meta{pgid:1}}}}
  var caught interface{}
  func(){defer func(){caught=recover()}();n.put([]byte(x.old),[]byte(x.new),[]byte("value"),x.page,leafPageFlag)}()
  if x.want!="" {if caught==nil||!strings.Contains(fmt.Sprint(caught),x.want){t.Fatalf("wanted %q panic; got %v",x.want,caught)}} else {
   if caught!=nil {t.Fatal(caught)}
   if len(n.inodes)!=1||string(n.inodes[0].key)!="a"||string(n.inodes[0].value)!="value" {t.Fatal("valid insertion lost")}
  }
 })}
}
